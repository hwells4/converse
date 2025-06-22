import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { handleWebhook, createWebhookHandler } from "../../utils/webhook-handler";

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
    const { documentId, status, completionData } = payload;
    
    console.log(`📄 Processing completion for document ${documentId} with status: ${status}`);
    console.log(`📊 Success: ${completionData.numberOfSuccessful}/${completionData.totalTransactions}`);
    
    if (completionData.failedTransactions?.length > 0) {
      console.log(`⚠️ ${completionData.failedTransactions.length} failed transactions`);
    }

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
    
    // For corrections, we know exactly how many transactions were processed
    // Since we can't reliably match by policy number (they may have changed),
    // we'll use the counts to update the failed transactions
    const currentFailedCount = currentCompletionData.failedTransactions?.length || 0;
    const processedCount = totalProcessed;
    
    console.log('🔍 [CORRECTION DEBUG] Current failed count:', currentFailedCount);
    console.log('🔍 [CORRECTION DEBUG] Current failed transactions:', currentCompletionData.failedTransactions?.map((tx: any) => tx.policyNumber));
    console.log('🔍 [CORRECTION DEBUG] Processed count:', processedCount);
    console.log('🔍 [CORRECTION DEBUG] Success count:', successCount);
    console.log('🔍 [CORRECTION DEBUG] Failure count:', failureCount);
    
    // SIMPLEST APPROACH: 
    // Original failed count - processed count + new failures = final failed count
    // But since ALL processed transactions were from the failed list, we can just:
    // 1. Remove ALL processed transactions (both successful and failed)
    // 2. Add back ONLY the new failures
    
    const remainingFailedTransactions = [];  // Start fresh - we'll only keep new failures
    
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
    
    // For corrections, the math is simple:
    // New successful count = old successful + corrections that succeeded
    const newSuccessfulCount = (currentCompletionData.numberOfSuccessful || 0) + successCount;
    const allFailedTransactions = newFailedTransactions; // Only the new failures
    
    console.log('🔍 [CORRECTION DEBUG] Remaining unprocessed:', remainingFailedTransactions.length);
    console.log('🔍 [CORRECTION DEBUG] New failures from N8N:', newFailedTransactions.length);
    console.log('🔍 [CORRECTION DEBUG] Final failed transactions:', allFailedTransactions.map((tx: any) => tx.policyNumber));
    console.log('🔍 [CORRECTION DEBUG] Final counts - Success:', newSuccessfulCount, 'Failed:', allFailedTransactions.length);
    
    // Validate calculations
    if (newSuccessfulCount < 0 || newSuccessfulCount + allFailedTransactions.length !== totalTransactions) {
      return {
        success: false,
        message: "Data integrity error: transaction counts don't add up",
        error: {
          successful: newSuccessfulCount,
          failed: allFailedTransactions.length,
          total: totalTransactions
        }
      };
    }
    
    const finalStatus = allFailedTransactions.length === 0 ? "completed" : "completed_with_errors";
    
    // Update completion data
    const updatedCompletionData = {
      ...currentCompletionData,
      numberOfSuccessful: newSuccessfulCount,
      failedTransactions: allFailedTransactions,
      message: allFailedTransactions.length === 0 
        ? `All ${totalTransactions} transactions completed successfully` 
        : `${newSuccessfulCount} of ${totalTransactions} transactions completed. ${allFailedTransactions.length} still have issues.`,
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
    console.log(`📊 Final counts: ${newSuccessfulCount} successful, ${allFailedTransactions.length} failed`);
    
    return {
      success: true,
      message: "Correction results processed successfully",
      data: {
        documentId,
        status: finalStatus,
        totalSuccessful: newSuccessfulCount,
        totalTransactions,
        remainingFailed: allFailedTransactions.length,
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