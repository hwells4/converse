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
  async (payload, req, res) => {
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
  async (payload, req, res) => {
    const { documentId, totalProcessed, successCount, failureCount, results, summary } = payload;
    
    console.log(`📄 Processing correction results for document ${documentId}`);
    console.log(`📊 Correction Summary: ${totalProcessed} processed, ${successCount} successful, ${failureCount} failed`);
    
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
    
    // Calculate which policy numbers were submitted for correction
    const submittedPolicyNumbers = new Set();
    (results.successful || []).forEach((success: any) => {
      submittedPolicyNumbers.add(success.policyNumber);
    });
    (results.failed || []).forEach((failed: any) => {
      submittedPolicyNumbers.add(failed.originalData?.policyNumber || failed.policyNumber);
    });
    
    // Remove all transactions that were submitted, add back only new failures
    const remainingFailedTransactions = (currentCompletionData.failedTransactions || []).filter((failedTx: any) => {
      const txPolicyNumber = failedTx.policyNumber || failedTx.originalData?.["Policy Number"];
      return !submittedPolicyNumbers.has(txPolicyNumber);
    });
    
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
    
    const allFailedTransactions = [...remainingFailedTransactions, ...newFailedTransactions];
    const newSuccessfulCount = totalTransactions - allFailedTransactions.length;
    
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