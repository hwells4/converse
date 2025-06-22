import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertDocumentSchema, updateDocumentSchema } from "@shared/schema";
import { resubmitFailedTransactionsSchema } from "../schemas/request-schemas";

const router = Router();

// Get all documents
router.get("/documents", async (req, res) => {
  try {
    const documents = await storage.getDocuments();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// Get single document
router.get("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`🔵 Fetching document ID: ${id}`);
    
    const document = await storage.getDocument(id);
    console.log(`📄 Document retrieved:`, {
      id: document?.id,
      filename: document?.filename,
      status: document?.status,
      jsonS3Key: document?.jsonS3Key,
      csvS3Key: document?.csvS3Key,
      textractJobId: document?.textractJobId,
      processedAt: document?.processedAt
    });
    
    if (!document) {
      console.log(`❌ Document ${id} not found`);
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    console.error("💥 Failed to fetch document:", error);
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

// Create new document record
router.post("/documents", async (req, res) => {
  try {
    const documentData = insertDocumentSchema.parse(req.body);
    const document = await storage.createDocument(documentData);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid document data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create document" });
  }
});

// Update document status/metadata
router.patch("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = updateDocumentSchema.parse(req.body);
    
    const document = await storage.updateDocument(id, updates);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid update data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update document" });
  }
});

// Delete document
router.delete("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const success = await storage.deleteDocument(id);
    
    if (!success) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.status(204).send(); // No content response for successful deletion
  } catch (error) {
    console.error("Failed to delete document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// Get documents by status
router.get("/documents/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const documents = await storage.getDocumentsByStatus(status);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents by status" });
  }
});

// Endpoint for resubmitting failed transactions to N8N
router.post("/documents/:id/resubmit-failed-transactions", async (req, res) => {
  console.log('🔵 [CLAUDE-FIXED-VERSION] Received failed transactions resubmission request');
  console.log('🔵 Document ID:', req.params.id);
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }
    
    const { correctedTransactions } = resubmitFailedTransactionsSchema.parse(req.body);
    
    // Get document details  
    const documentData = await storage.getDocument(documentId);
    if (!documentData) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if document is in a valid state for corrections
    // Allow corrections for documents that have completed but may have errors, or failed entirely
    const allowedStatusesForCorrection = ['completed_with_errors', 'failed', 'correction_pending', 'completed'];
    if (!allowedStatusesForCorrection.includes(documentData.status)) {
      return res.status(400).json({ 
        message: `Cannot resubmit corrections for document with status: ${documentData.status}. Document must be in a correctable state.`,
        currentStatus: documentData.status,
        allowedStatuses: allowedStatusesForCorrection
      });
    }

    // Verify there are actually failed transactions to correct
    const currentMetadata = documentData.metadata as any;
    const failedTransactions = currentMetadata?.completionData?.failedTransactions || [];
    if (failedTransactions.length === 0) {
      return res.status(400).json({ 
        message: "No failed transactions found to correct. Document appears to be fully processed.",
        currentStatus: documentData.status
      });
    }
    
    // N8N webhook URLs for commission correction
    const N8N_CORRECTION_TEST_URL = "https://hwells4.app.n8n.cloud/webhook-test/commission-correction";
    const N8N_CORRECTION_PROD_URL = "https://hwells4.app.n8n.cloud/webhook/commission-correction";
    
    // Configuration for easy switching between test and production
    // Set COMMISSION_CORRECTION_WEBHOOK_URL environment variable to override, or change USE_PRODUCTION_CORRECTION below
    const USE_PRODUCTION_CORRECTION = false; // Change this to true for production
    const TEST_MODE = false; // Change this to true to skip N8N webhook calls for testing
    
    const correctionWebhookUrl = process.env.COMMISSION_CORRECTION_WEBHOOK_URL || (USE_PRODUCTION_CORRECTION ? N8N_CORRECTION_PROD_URL : N8N_CORRECTION_TEST_URL);
    
    console.log(`🔗 Using N8N correction webhook: ${USE_PRODUCTION_CORRECTION ? 'PRODUCTION' : 'TEST'} - ${correctionWebhookUrl}`);
    console.log(`🧪 Test mode: ${TEST_MODE ? 'ENABLED (skipping webhook)' : 'DISABLED'}`);
    console.log(`🚀 Resubmitting ${correctedTransactions.length} corrected transactions for document ${documentId}`);
    
    // Use the same webhook URL pattern as your working system - get current domain
    const currentHost = req.get('host');
    const protocol = req.get('host')?.includes('replit.dev') ? 'https' : req.protocol;
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `${protocol}://${currentHost}`;
    const completionWebhookUrl = `${webhookBaseUrl}/api/webhook/n8n-correction-completion`;
    
    console.log('🔗 Correction webhook URL (no document ID in URL):', completionWebhookUrl);
    console.log('💡 Document ID will be included in the request body instead');
    
    // Get current document to access failed transactions
    const currentDoc = await storage.getDocument(documentId);
    const currentFailedTransactions = (currentDoc?.metadata as any)?.completionData?.failedTransactions || [];
    
    const correctionPayload = {
      transactions: correctedTransactions.map((transaction, index) => ({
        originalFailedTransactionIndex: index, // Track which failed transaction this was
        // Store the ORIGINAL wrong policy number from before user's edits
        originalPolicyNumber: currentFailedTransactions[index]?.policyNumber || 
                            currentFailedTransactions[index]?.originalData?.["Policy Number"] || 
                            transaction.policyNumber,
        statementId: transaction.commissionStatementId || transaction.originalData["Commission Statement"],
        policyNumber: transaction.originalData["Policy Number"] || transaction.policyNumber, // Corrected policy number
        insuredName: transaction.originalData["Name of Insured"] || null,
        transactionAmount: transaction.originalData["Transaction Amount"] || transaction.transactionAmount
      })),
      webhookUrl: completionWebhookUrl, // Tell n8n where to send the completion response
      documentId: documentId // Include document ID in payload - N8N will include this in the webhook body
    };
    
    console.log('📤 Correction payload:', JSON.stringify(correctionPayload, null, 2));
    
    // Update document status to correction_pending immediately when corrections are submitted
    await storage.updateDocument(documentId, {
      status: "correction_pending"
    });
    console.log(`✅ Document ${documentId} status updated to correction_pending`);
    
    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Skipping N8N correction webhook call');
      console.log('📋 Payload that would be sent:', JSON.stringify(correctionPayload, null, 2));
      
      res.json({
        success: true,
        message: `TEST MODE: ${correctedTransactions.length} transaction(s) would be resubmitted`,
        resubmittedCount: correctedTransactions.length,
        documentId,
        testMode: true
      });
    } else {
      console.log('🚀 Sending corrected transactions to N8N webhook...');
      console.log('🔗 Webhook URL:', correctionWebhookUrl);
      console.log('📤 Payload being sent to N8N:', JSON.stringify(correctionPayload, null, 2));
      
      const n8nResponse = await fetch(correctionWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(correctionPayload)
      });
      
      console.log('📡 N8N Response Status:', n8nResponse.status);
      console.log('📡 N8N Response Headers:', Object.fromEntries(n8nResponse.headers.entries()));
      
      if (!n8nResponse.ok) {
        console.error('❌ N8N correction webhook call failed:', n8nResponse.status, n8nResponse.statusText);
        
        // Try to get response text for debugging
        let errorText = '';
        try {
          errorText = await n8nResponse.text();
          console.error('❌ N8N response body:', errorText);
        } catch (e) {
          console.error('❌ Could not read N8N response body');
        }
        
        return res.status(500).json({ 
          success: false,
          message: "Failed to send corrected transactions to N8N webhook",
          error: `${n8nResponse.status} ${n8nResponse.statusText}`,
          responseBody: errorText.substring(0, 500)
        });
      }
      
      const n8nResult = await n8nResponse.text();
      console.log('✅ N8N correction webhook response:', n8nResult);
      console.log('✅ N8N response status:', n8nResponse.status);
      
      // N8N will send results via HTTP Request node to the webhook URL
      res.json({
        success: true,
        message: `${correctedTransactions.length} transaction(s) have been sent for correction. Results will be processed via webhook.`,
        resubmittedCount: correctedTransactions.length,
        documentId,
        webhookUrl: completionWebhookUrl
      });
    }
    
  } catch (error) {
    console.error('❌ Error during failed transactions resubmission:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to resubmit transactions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export const documentRoutes = router;