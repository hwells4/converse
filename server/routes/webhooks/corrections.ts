import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";

const router = Router();

// N8N correction completion webhook endpoint
router.post("/webhook/n8n-correction-completion", async (req, res) => {
  console.log('🔵 ========== CORRECTION WEBHOOK RECEIVED ==========');
  console.log('🔵 Timestamp:', new Date().toISOString());
  console.log('🔵 URL hit:', req.url);
  console.log('🔵 Method:', req.method);
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔵 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔵 ====================================');
  
  try {
    // Handle array format from N8N
    let correctionData;
    if (Array.isArray(req.body) && req.body.length > 0) {
      console.log('🔍 Detected array format from N8N, extracting first element');
      correctionData = req.body[0];
    } else {
      correctionData = req.body;
    }
    
    // Get document ID from request body (same pattern as your working webhook)
    const documentId = correctionData.documentId || correctionData.document?.id;
    
    if (!documentId) {
      console.error('❌ No documentId provided in webhook body');
      return res.status(400).json({ 
        success: false,
        message: "Document ID required in request body" 
      });
    }
    
    console.log(`📄 Processing correction results for document ${documentId}`);
    
    // Handle the correction webhook format: { totalProcessed, successCount, failureCount, results: { successful: [...], failed: [...] }, documentId }
    const { totalProcessed, successCount, failureCount, results, summary } = correctionData;
    
    if (!results || (!results.successful && !results.failed)) {
      console.error('❌ Invalid correction results structure');
      return res.status(400).json({ 
        success: false,
        message: "Invalid correction results structure - missing successful/failed arrays" 
      });
    }
    
    console.log('📊 Correction Summary:');
    console.log(`   Total Processed: ${totalProcessed}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failureCount}`);
    console.log(`   Summary: ${summary}`);
    
    // Get current document state from our database
    const currentDocument = await storage.getDocument(documentId);
    if (!currentDocument) {
      return res.status(404).json({ 
        success: false,
        message: "Document not found" 
      });
    }
    
    const currentMetadata = currentDocument.metadata as any;
    const currentCompletionData = currentMetadata?.completionData || {};
    
    console.log('🔍 Current completion data:', JSON.stringify(currentCompletionData, null, 2));
    
    // Calculate success count based on remaining failed transactions (avoid double-counting)
    const totalTransactions = currentCompletionData.totalTransactions || 0;
    
    console.log(`📊 Correction update: ${successCount} successful, ${failureCount} failed from this batch`);
    
    // Get the policy numbers that were submitted for correction
    const submittedPolicyNumbers = new Set();
    (results.successful || []).forEach((success: any) => {
      submittedPolicyNumbers.add(success.policyNumber);
    });
    (results.failed || []).forEach((failed: any) => {
      submittedPolicyNumbers.add(failed.originalData?.policyNumber || failed.policyNumber);
    });
    
    console.log('🔍 Policy numbers submitted for correction:', Array.from(submittedPolicyNumbers));
    
    // Remove ALL transactions that were submitted (both successful and failed attempts)
    const remainingFailedTransactions = (currentCompletionData.failedTransactions || []).filter((failedTx: any) => {
      const txPolicyNumber = failedTx.policyNumber || failedTx.originalData?.["Policy Number"];
      const wasSubmitted = submittedPolicyNumbers.has(txPolicyNumber);
      console.log(`🔍 Policy ${txPolicyNumber}: was submitted = ${wasSubmitted}`);
      return !wasSubmitted; // Keep only transactions that were NOT submitted for correction
    });
    
    // Add back only the transactions that failed in this correction attempt
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
    
    // Combine untouched failed transactions with new failures
    const allFailedTransactions = [...remainingFailedTransactions, ...newFailedTransactions];
    
    // Calculate successful count correctly: total - remaining failed
    const newSuccessfulCount = totalTransactions - allFailedTransactions.length;
    
    // Validate the math makes sense
    if (newSuccessfulCount < 0) {
      console.error(`❌ Invalid calculation: successful count cannot be negative (${newSuccessfulCount})`);
      return res.status(500).json({
        success: false,
        message: "Data integrity error: invalid transaction counts"
      });
    }
    
    if (newSuccessfulCount + allFailedTransactions.length !== totalTransactions) {
      console.error(`❌ Math validation failed: ${newSuccessfulCount} + ${allFailedTransactions.length} ≠ ${totalTransactions}`);
      return res.status(500).json({
        success: false,
        message: "Data integrity error: transaction counts don't add up"
      });
    }
    
    console.log('📊 Failed transactions breakdown:');
    console.log(`   Previous failed count: ${currentCompletionData.failedTransactions?.length || 0}`);
    console.log(`   Submitted for correction: ${submittedPolicyNumbers.size}`);
    console.log(`   Remaining untouched: ${remainingFailedTransactions.length}`);
    console.log(`   New failures from correction: ${newFailedTransactions.length}`);
    console.log(`   Final failed count: ${allFailedTransactions.length}`);
    console.log(`   Calculated successful count: ${totalTransactions} - ${allFailedTransactions.length} = ${newSuccessfulCount}`);
    console.log(`✅ Math validation passed: ${newSuccessfulCount} + ${allFailedTransactions.length} = ${totalTransactions}`);
    
    // Determine final status
    const allTransactionsSuccessful = newSuccessfulCount === totalTransactions && allFailedTransactions.length === 0;
    const finalStatus = allTransactionsSuccessful ? "completed" : "completed_with_errors";
    
    // Update completion data
    const updatedCompletionData = {
      ...currentCompletionData,
      numberOfSuccessful: newSuccessfulCount,
      failedTransactions: allFailedTransactions,
      message: allTransactionsSuccessful 
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
    
    console.log('🔄 UPDATING DATABASE...');
    console.log('📝 Document ID:', documentId);
    console.log('📝 New Status:', finalStatus);
    console.log('📝 Updated failed transactions count:', allFailedTransactions.length);
    console.log('📝 Total successful:', newSuccessfulCount);
    
    const updatedDocument = await storage.updateDocument(documentId, {
      status: finalStatus,
      metadata: {
        completionData: updatedCompletionData
      }
    });
    
    console.log('✅ DATABASE UPDATE COMPLETE!');
    console.log(`📊 Document ${documentId} status is now: ${finalStatus}`);
    console.log(`📊 Total successful: ${newSuccessfulCount}/${totalTransactions}`);
    console.log(`⚠️ Remaining failed: ${allFailedTransactions.length}`);
    console.log('🔄 Frontend should see this update within 5 seconds due to polling...');
    
    res.json({
      success: true,
      message: "Correction results processed successfully",
      document: {
        id: documentId,
        status: finalStatus,
        totalSuccessful: newSuccessfulCount,
        totalTransactions: totalTransactions,
        remainingFailed: allFailedTransactions.length,
        isFullyComplete: finalStatus === "completed"
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing correction completion webhook:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to process correction completion",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export const correctionWebhookRoutes = router;