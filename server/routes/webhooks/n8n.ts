import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { n8nCompletionWebhookSchema, n8nCompletionWebhookArraySchema } from "@shared/schema";

const router = Router();

// NEW: Simplified N8N completion webhook that accepts the correct payload format
router.post("/webhook/n8n-completion", async (req, res) => {
  console.log('🔵 [NEW] Received N8N completion webhook');
  console.log('🔵 [NEW] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Handle N8N's array format - take first element
    let payload = Array.isArray(req.body) ? req.body[0] : req.body;
    
    const { documentId, status, completionData } = payload;
    
    if (!documentId || !status || !completionData) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: documentId, status, completionData"
      });
    }
    
    console.log(`📄 Processing completion for document ${documentId} with status: ${status}`);
    console.log(`📊 Success: ${completionData.numberOfSuccessful}/${completionData.totalTransactions}`);
    
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
      return res.status(404).json({
        success: false,
        message: "Document not found",
        error: { documentId }
      });
    }

    console.log(`✅ Document ${documentId} updated to ${status}`);

    res.json({
      success: true,
      message: `Document status updated to ${status}`,
      data: {
        documentId,
        status,
        totalSuccessful: completionData.numberOfSuccessful,
        totalTransactions: completionData.totalTransactions,
        failedCount: completionData.failedTransactions?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing N8N completion webhook:', error);
    res.status(500).json({
      success: false,
      message: "Failed to process completion webhook",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Old webhook code removed - using simplified version above

// Simple test to verify correction webhook route exists
router.get("/webhook/n8n-correction-completion", async (req, res) => {
  res.json({ 
    message: "N8N correction completion webhook endpoint exists", 
    method: "POST expected",
    timestamp: new Date().toISOString()
  });
});

export const n8nWebhookRoutes = router;