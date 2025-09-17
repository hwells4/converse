import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { handleWebhook, createWebhookHandler } from "../../utils/webhook-handler";

// Utility functions for transaction validation
function validateTransactionCounts(
  successful: number, 
  failed: number, 
  total: number,
  context: string
): { isValid: boolean; error?: any } {
  if (successful < 0 || failed < 0 || total < 0) {
    return {
      isValid: false,
      error: {
        type: "negative_counts",
        context,
        successful,
        failed,
        total
      }
    };
  }
  
  if (successful + failed !== total) {
    return {
      isValid: false,
      error: {
        type: "count_mismatch",
        context,
        successful,
        failed,
        total,
        actualTotal: successful + failed,
        difference: total - (successful + failed)
      }
    };
  }
  
  return { isValid: true };
}

function logTransactionState(documentId: number, stage: string, data: any) {
  console.log(`📊 [${stage}] Document ${documentId} transaction state:`);
  Object.entries(data).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
}

const router = Router();

// Simplified N8N completion webhook schema
const n8nCompletionPayloadSchema = z.object({
  documentId: z.number(),
  status: z.enum(["completed", "completed_with_errors", "failed"]),
  completionData: z.object({
    carrierName: z.string(),
    numberOfSuccessful: z.number(),
    totalTransactions: z.number(),
    failedTransactions: z.array(z.any()).default([]),
    message: z.string(),
    completedAt: z.string()
  })
}).or(
  // Support N8N's array format
  z.array(z.object({
    documentId: z.number(),
    status: z.enum(["completed", "completed_with_errors", "failed"]),
    completionData: z.object({
      carrierName: z.string(),
      numberOfSuccessful: z.number(),
      totalTransactions: z.number(),  
      failedTransactions: z.array(z.any()).default([]),
      message: z.string(),
      completedAt: z.string()
    })
  })).transform(arr => arr[0]) // Take first element if array
).or(
  // Support nested results format
  z.object({
    results: z.array(z.object({
      documentId: z.number(),
      status: z.enum(["completed", "completed_with_errors", "failed"]),
      completionData: z.object({
        carrierName: z.string(),
        numberOfSuccessful: z.number(),
        totalTransactions: z.number(),
        failedTransactions: z.array(z.any()).default([]),
        message: z.string(),
        completedAt: z.string()
      })
    }))
  }).transform(data => data.results[0]) // Take first result
);

// N8N correction completion schema
const n8nCorrectionPayloadSchema = z.object({
  documentId: z.number(),
  totalProcessed: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  results: z.object({
    successful: z.array(z.any()).optional(),
    failed: z.array(z.any()).optional()
  }),
  summary: z.string().optional()
}).or(
  // Support N8N array format
  z.array(z.object({
    documentId: z.number(),
    totalProcessed: z.number(),
    successCount: z.number(),
    failureCount: z.number(),
    results: z.object({
      successful: z.array(z.any()).optional(),
      failed: z.array(z.any()).optional()
    }),
    summary: z.string().optional()
  })).transform(arr => arr[0])
);

// N8N completion webhook handler
const completionHandler = createWebhookHandler(
  "n8n-completion",
  async (payload: any, req, res) => {
    console.log('🔍 DEBUG: Completion handler called with payload:', JSON.stringify(payload, null, 2));
    const { documentId, status, completionData } = payload;
    
    console.log(`📄 Processing completion for document ${documentId} with status: ${status}`);
    console.log(`📊 Success: ${completionData.numberOfSuccessful}/${completionData.totalTransactions}`);
    
    if (completionData.failedTransactions?.length > 0) {
      console.log(`⚠️ ${completionData.failedTransactions.length} failed transactions`);
    }

    // VALIDATION: Ensure transaction counts add up correctly
    const successfulCount = completionData.numberOfSuccessful;
    const failedCount = completionData.failedTransactions?.length || 0;
    const totalTransactions = completionData.totalTransactions;
    
    logTransactionState(documentId, "COMPLETION", {
      successful: successfulCount,
      failed: failedCount,
      total: totalTransactions
    });
    
    const validation = validateTransactionCounts(
      successfulCount,
      failedCount,
      totalTransactions,
      "N8N completion"
    );
    
    if (!validation.isValid) {
      console.error('🚨 TRANSACTION COUNT VALIDATION FAILED:', validation.error);
      
      return {
        success: false,
        message: `Transaction count validation failed: ${validation.error?.type}`,
        error: { ...validation.error, documentId }
      };
    }
    
    console.log(`✅ Transaction counts validated: ${successfulCount} + ${failedCount} = ${totalTransactions}`);

    // Update document in database
    const updatedDocument = await storage.updateDocument(documentId, {
      status,
      metadata: {
        completionData: {
          carrierName: completionData.carrierName,
          numberOfSuccessful: completionData.numberOfSuccessful,
          totalTransactions: completionData.totalTransactions,
          failedTransactions: completionData.failedTransactions || [],
          message: completionData.message,
          completedAt: completionData.completedAt
        }
      }
    });

    if (!updatedDocument) {
      return {
        success: false,
        message: "Document not found",
        error: { documentId }
      };
    }

    console.log(`✅ Document ${documentId} updated to ${status}`);

    return {
      success: true,
      message: `Document status updated to ${status}`,
      data: {
        documentId,
        status,
        totalSuccessful: completionData.numberOfSuccessful,
        totalTransactions: completionData.totalTransactions,
        failedCount: completionData.failedTransactions?.length || 0
      }
    };
  },
  n8nCompletionPayloadSchema
);

// N8N correction completion handler
const correctionHandler = createWebhookHandler(
  "n8n-correction-completion",
  async (payload: any, req, res) => {
    const { documentId, totalProcessed, successCount, failureCount, results, summary } = payload;
    
    console.log(`📄 [v2] Processing correction results for document ${documentId}`);
    console.log(`📊 [v2] Correction Summary: ${totalProcessed} processed, ${successCount} successful, ${failureCount} failed`);
    console.log(`🚀 [v2] NEW SIMPLE MATH LOGIC ACTIVE`);
    
    // Get current document state
    const currentDocument = await storage.getDocument(documentId);
    if (!currentDocument) {
      return {
        success: false,
        message: "Document not found",
        error: { documentId }
      };
    }

    const currentMetadata = currentDocument.metadata as any;
    const currentCompletionData = currentMetadata?.completionData || {};
    const totalTransactions = currentCompletionData.totalTransactions || 0;
    const currentSuccessfulCount = currentCompletionData.numberOfSuccessful || 0;
    const currentFailedTransactions = currentCompletionData.failedTransactions || [];
    const currentFailedCount = currentFailedTransactions.length;
    
    console.log('🔍 [CORRECTION DEBUG] Current state:');
    console.log('  - Total transactions:', totalTransactions);
    console.log('  - Current successful:', currentSuccessfulCount);
    console.log('  - Current failed count:', currentFailedCount);
    console.log('  - Current failed policies:', currentFailedTransactions.map((tx: any) => tx.policyNumber));
    console.log('🔍 [CORRECTION DEBUG] Correction attempt:');
    console.log('  - Processed count:', totalProcessed);
    console.log('  - Success count:', successCount);
    console.log('  - Failure count:', failureCount);
    
    // VALIDATION: Ensure correction counts make sense
    const correctionValidation = validateTransactionCounts(
      successCount,
      failureCount,
      totalProcessed,
      "N8N correction"
    );
    
    if (!correctionValidation.isValid) {
      console.error('🚨 CORRECTION COUNT VALIDATION FAILED:', correctionValidation.error);
      
      return {
        success: false,
        message: `Correction count validation failed: ${correctionValidation.error?.type}`,
        error: { ...correctionValidation.error, documentId }
      };
    }
    
    // VALIDATION: Ensure we're not processing more than currently failed
    if (totalProcessed > currentFailedCount) {
      const validationError = {
        documentId,
        currentFailedCount,
        totalProcessed,
        excess: totalProcessed - currentFailedCount
      };
      
      console.error('🚨 CORRECTION EXCEEDS FAILED COUNT:', validationError);
      
      return {
        success: false,
        message: "Cannot process more transactions than currently failed",
        error: validationError
      };
    }
    
    // SIMPLIFIED CORRECTION LOGIC:
    // 1. Add successful corrections to successful count
    // 2. Replace failed transactions with only the NEW failures
    const newSuccessfulCount = currentSuccessfulCount + successCount;
    
    const newFailedTransactions = (results.failed || []).map((failedResult: any) => ({
      type: "policy_not_found",
      error: failedResult.error,
      insuredName: failedResult.originalData?.insuredName,
      statementId: failedResult.originalData?.statementId,
      originalData: {
        "Policy Name": null,
        "Policy Number": failedResult.originalData?.policyNumber || failedResult.policyNumber,
        "Name of Insured": failedResult.originalData?.insuredName,
        "Transaction Type": null,
        "Transaction Amount": failedResult.originalData?.transactionAmount || failedResult.amount,
        "Commission Statement": failedResult.originalData?.statementId
      },
      policyNumber: failedResult.originalData?.policyNumber || failedResult.policyNumber,
      transactionAmount: failedResult.originalData?.transactionAmount || failedResult.amount,
      commissionStatementId: failedResult.originalData?.statementId
    }));
    
    console.log('🔍 [CORRECTION DEBUG] Calculated results:');
    console.log('  - New successful count:', newSuccessfulCount);
    console.log('  - New failed count:', newFailedTransactions.length);
    console.log('  - New failed policies:', newFailedTransactions.map((tx: any) => tx.policyNumber));
    
    // FINAL VALIDATION: Ensure total still adds up
    logTransactionState(documentId, "FINAL_CORRECTION", {
      successful: newSuccessfulCount,
      failed: newFailedTransactions.length,
      total: totalTransactions
    });
    
    const finalValidation = validateTransactionCounts(
      newSuccessfulCount,
      newFailedTransactions.length,
      totalTransactions,
      "Final correction state"
    );
    
    if (!finalValidation.isValid) {
      console.error('🚨 FINAL VALIDATION FAILED:', finalValidation.error);
      
      return {
        success: false,
        message: `Final validation failed: ${finalValidation.error?.type}`,
        error: { ...finalValidation.error, documentId }
      };
    }
    
    console.log('✅ All validation checks passed for correction');
    
    const finalStatus = newFailedTransactions.length === 0 ? "completed" : "completed_with_errors";
    
    // Update completion data
    const updatedCompletionData = {
      ...currentCompletionData,
      numberOfSuccessful: newSuccessfulCount,
      failedTransactions: newFailedTransactions,
      message: newFailedTransactions.length === 0 
        ? `All ${totalTransactions} transactions completed successfully` 
        : `${newSuccessfulCount} of ${totalTransactions} transactions completed. ${newFailedTransactions.length} still have issues.`,
      lastCorrectionAt: new Date().toISOString(),
      correctionHistory: [
        ...(currentCompletionData.correctionHistory || []),
        {
          timestamp: new Date().toISOString(),
          attempted: totalProcessed,
          successful: successCount,
          failed: failureCount,
          summary: summary || `Processed ${totalProcessed} corrections`
        }
      ]
    };
    
    const updatedDocument = await storage.updateDocument(documentId, {
      status: finalStatus,
      metadata: {
        completionData: updatedCompletionData
      }
    });
    
    console.log(`✅ Document ${documentId} correction completed - Status: ${finalStatus}`);
    console.log(`📊 Final counts: ${newSuccessfulCount} successful, ${newFailedTransactions.length} failed`);
    
    return {
      success: true,
      message: "Correction results processed successfully",
      data: {
        documentId,
        status: finalStatus,
        totalSuccessful: newSuccessfulCount,
        totalTransactions,
        remainingFailed: newFailedTransactions.length,
        isFullyComplete: finalStatus === "completed"
      }
    };
  },
  n8nCorrectionPayloadSchema
);

// Register webhook routes
router.post("/webhook/n8n-completion", (req, res) => 
  handleWebhook(completionHandler, req, res)
);

router.post("/webhook/n8n-correction-completion", (req, res) => 
  handleWebhook(correctionHandler, req, res)
);

// Test endpoints
router.get("/webhook/n8n-completion", (req, res) => {
  res.json({ 
    message: "N8N completion webhook endpoint",
    method: "POST expected",
    timestamp: new Date().toISOString()
  });
});

router.get("/webhook/n8n-correction-completion", (req, res) => {
  res.json({ 
    message: "N8N correction completion webhook endpoint", 
    method: "POST expected",
    timestamp: new Date().toISOString()
  });
});

export const n8nUnifiedWebhookRoutes = router;