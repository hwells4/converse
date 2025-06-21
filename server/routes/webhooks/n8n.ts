import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { n8nCompletionWebhookSchema, n8nCompletionWebhookArraySchema } from "@shared/schema";

const router = Router();

// N8N completion webhook endpoint
router.post("/webhook/n8n-completion", async (req, res) => {
  console.log('🔵 Received N8N completion webhook');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔵 Request headers:', req.headers);
  
  try {
    // Handle both array and single object formats
    let payloadArray: any[];
    
    // Check if we have an array with objects containing 'results'
    if (Array.isArray(req.body) && req.body.length > 0 && req.body[0].results && Array.isArray(req.body[0].results)) {
      console.log('🔍 [DEBUG] Detected array with results format from N8N');
      payloadArray = req.body[0].results;
    } else if (req.body && req.body.results && Array.isArray(req.body.results)) {
      console.log('🔍 [DEBUG] Detected webhook with results array format');
      payloadArray = req.body.results;
    } else if (Array.isArray(req.body)) {
      // Validate as array
      const validatedArray = n8nCompletionWebhookArraySchema.parse(req.body);
      payloadArray = validatedArray;
    } else {
      // Validate as single object
      const validatedPayload = n8nCompletionWebhookSchema.parse(req.body);
      payloadArray = [validatedPayload];
    }
    
    console.log(`📊 Processing ${payloadArray.length} completion notification(s)`);
    console.log('🔍 [DEBUG] Raw payloadArray:', JSON.stringify(payloadArray, null, 2));
    
    const results = [];
    
    for (const payload of payloadArray) {
      try {
        // Extract document from payload - handle both direct document and results format
        const document = payload.document || payload;
        console.log('✅ N8N completion webhook payload validation passed for document:', document.id);
        
        const documentId = document.id;
        const completionData = document.metadata.completionData;
        
        // Debug logging for failed transactions detection
        console.log('🔍 [DEBUG] Completion data received:');
        console.log('🔍 [DEBUG] failedTransactions:', JSON.stringify(completionData.failedTransactions, null, 2));
        console.log('🔍 [DEBUG] failedTransactions length:', completionData.failedTransactions?.length);
        console.log('🔍 [DEBUG] numberOfSuccessful:', completionData.numberOfSuccessful);
        console.log('🔍 [DEBUG] totalTransactions:', completionData.totalTransactions);
        console.log('🔍 [DEBUG] message:', completionData.message);
        
        // Determine final status based on failed transactions
        const hasFailedTransactions = completionData.failedTransactions && completionData.failedTransactions.length > 0;
        const finalStatus = hasFailedTransactions ? "completed_with_errors" : "completed";
        
        console.log('🔍 [DEBUG] hasFailedTransactions:', hasFailedTransactions);
        console.log('🔍 [DEBUG] finalStatus will be set to:', finalStatus);
        
        // Update document status to completed or completed_with_errors based on failures
        console.log('🔍 [DEBUG] About to update document with status:', finalStatus);
        console.log('🔍 [DEBUG] Update payload:', {
          status: finalStatus,
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
        
        const updatedDocument = await storage.updateDocument(documentId, {
          status: finalStatus,
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
          console.error('❌ Document not found for ID:', documentId);
          results.push({ 
            documentId,
            success: false, 
            message: "Document not found" 
          });
          continue;
        }

        console.log(`✅ Document ${documentId} marked as ${finalStatus}`);
        console.log(`📊 Upload results: ${completionData.numberOfSuccessful}/${completionData.totalTransactions} successful`);
        
        if (completionData.failedTransactions && completionData.failedTransactions.length > 0) {
          console.log(`⚠️ ${completionData.failedTransactions.length} transactions failed`);
          console.log(`🔍 Failed transactions:`, completionData.failedTransactions);
        }

        results.push({
          documentId,
          success: true,
          message: `Document status updated to ${finalStatus}`,
          document: updatedDocument
        });
        
      } catch (payloadError) {
        console.error('❌ Error processing individual completion payload:', payloadError);
        results.push({
          success: false,
          message: "Failed to process individual completion",
          error: payloadError instanceof Error ? payloadError.message : "Unknown error"
        });
      }
    }
    
    // Return results
    const allSuccessful = results.every(r => r.success);
    
    res.json({ 
      success: allSuccessful,
      message: allSuccessful ? "All documents processed successfully" : "Some documents failed to process",
      results
    });
    
  } catch (error) {
    console.error('❌ Error processing N8N completion webhook:', error);
    
    if (error instanceof z.ZodError) {
      console.error('❌ Webhook validation errors:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ 
        success: false,
        message: "Invalid webhook payload", 
        errors: error.errors,
        receivedPayload: req.body
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to process completion webhook",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Simple test to verify correction webhook route exists
router.get("/webhook/n8n-correction-completion", async (req, res) => {
  res.json({ 
    message: "N8N correction completion webhook endpoint exists", 
    method: "POST expected",
    timestamp: new Date().toISOString()
  });
});

export const n8nWebhookRoutes = router;