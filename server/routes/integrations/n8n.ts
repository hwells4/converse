import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { n8nWebhookPayloadSchema } from "@shared/schema";
import { n8nStatusCallbackSchema, resubmitFailedTransactionsSchema } from "../../schemas/request-schemas";

const router = Router();

// N8N webhook endpoint for Salesforce upload
router.post("/n8n/salesforce-upload", async (req, res) => {
  console.log('🔵 N8N Salesforce upload webhook called');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate the payload
    const validatedPayload = n8nWebhookPayloadSchema.parse(req.body);
    console.log('✅ N8N payload validation passed');
    
    // Update document status to indicate Salesforce upload is pending
    const document = await storage.getDocument(validatedPayload.documentId);
    if (!document) {
      console.error(`❌ Document not found for ID: ${validatedPayload.documentId}`);
      return res.status(404).json({ 
        success: false,
        message: "Document not found" 
      });
    }

    await storage.updateDocument(validatedPayload.documentId, {
      status: "salesforce_upload_pending"
    });

    console.log(`✅ Document ${validatedPayload.documentId} status updated to salesforce_upload_pending`);

    // Call N8N webhook - Easy switching between test and production
    const N8N_TEST_URL = "https://hwells4.app.n8n.cloud/webhook-test/832afa61-2bcc-433c-8df6-192009696764";
    const N8N_PROD_URL = "https://hwells4.app.n8n.cloud/webhook/832afa61-2bcc-433c-8df6-192009696764";
    
    // Use environment variable or default to test URL
    // Set N8N_WEBHOOK_URL environment variable to override, or change USE_PRODUCTION_N8N below
    const USE_PRODUCTION_N8N = false; // Change this to true for production
    const TEST_MODE = false; // Change this to true to skip N8N webhook calls for testing
    
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || (USE_PRODUCTION_N8N ? N8N_PROD_URL : N8N_TEST_URL);
    
    console.log(`🔗 Using N8N webhook: ${USE_PRODUCTION_N8N ? 'PRODUCTION' : 'TEST'} - ${n8nWebhookUrl}`);
    console.log(`🧪 Test mode: ${TEST_MODE ? 'ENABLED (skipping webhook)' : 'DISABLED'}`);

    if (TEST_MODE) {
      console.log('🧪 TEST MODE: Skipping N8N webhook call');
      console.log('📋 Payload that would be sent:', JSON.stringify(validatedPayload, null, 2));
    } else {
      console.log('🚀 Sending data to N8N webhook...');
      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedPayload)
      });

      if (!n8nResponse.ok) {
        console.error('❌ N8N webhook call failed:', n8nResponse.status, n8nResponse.statusText);
        
        // Try to get response text for debugging
        let errorText = '';
        try {
          errorText = await n8nResponse.text();
          console.error('❌ N8N response body:', errorText);
        } catch (e) {
          console.error('❌ Could not read N8N response body');
        }
        
        // Update document status to failed
        await storage.updateDocument(validatedPayload.documentId, {
          status: "salesforce_upload_failed",
          processingError: `N8N webhook failed: ${n8nResponse.status} ${n8nResponse.statusText} - ${errorText.substring(0, 200)}`
        });

        return res.status(500).json({ 
          success: false,
          message: "Failed to send data to N8N webhook",
          error: `${n8nResponse.status} ${n8nResponse.statusText}`,
          responseBody: errorText.substring(0, 500)
        });
      }

      const n8nResult = await n8nResponse.text();
      console.log('✅ N8N webhook response:', n8nResult);
      console.log('✅ N8N response status:', n8nResponse.status);
      console.log('✅ N8N response headers:', Object.fromEntries(n8nResponse.headers.entries()));
    }

    res.json({
      success: true,
      message: "Data sent to N8N successfully",
      statement: validatedPayload.statement,
      transactionCount: validatedPayload.transactionCount
    });

  } catch (error) {
    console.error('💥 N8N webhook error:', error);
    
    if (error instanceof z.ZodError) {
      console.error('❌ N8N payload validation failed:', error.errors);
      return res.status(400).json({ 
        success: false,
        message: "Invalid payload for N8N webhook", 
        errors: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to process N8N webhook request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// N8N status callback endpoint (for N8N to report back success/failure)
router.post("/n8n/salesforce-status", async (req, res) => {
  console.log('🔵 N8N status callback received');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { documentId, status, message } = n8nStatusCallbackSchema.parse(req.body);

    const document = await storage.getDocument(documentId);
    if (!document) {
      console.error(`❌ Document not found for ID: ${documentId}`);
      return res.status(404).json({ 
        success: false,
        message: "Document not found" 
      });
    }

    let newStatus: string;
    let processingError: string | null = null;

    if (status === "success") {
      newStatus = "uploaded_to_salesforce";
      console.log(`✅ Document ${documentId} successfully uploaded to Salesforce`);
    } else if (status === "error" || status === "failed") {
      newStatus = "salesforce_upload_failed";
      processingError = message || "Salesforce upload failed";
      console.log(`❌ Document ${documentId} failed to upload to Salesforce: ${processingError}`);
    } else {
      return res.status(400).json({ 
        success: false,
        message: "Invalid status. Must be 'success' or 'error'" 
      });
    }

    await storage.updateDocument(documentId, {
      status: newStatus,
      ...(processingError && { processingError })
    });

    console.log(`✅ Document ${documentId} status updated to ${newStatus}`);

    res.json({
      success: true,
      message: "Document status updated successfully",
      documentId,
      status: newStatus
    });

  } catch (error) {
    console.error('💥 N8N status callback error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to process status callback",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Endpoint for resubmitting failed transactions to N8N
router.post("/documents/:id/resubmit-failed-transactions", async (req, res) => {
  console.log('🔵 Received failed transactions resubmission request');
  console.log('🔵 Document ID:', req.params.id);
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }
    
    const { correctedTransactions } = resubmitFailedTransactionsSchema.parse(req.body);
    
    // Get document details
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
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
    
    const correctionPayload = {
      transactions: correctedTransactions.map(transaction => ({
        statementId: transaction.commissionStatementId || transaction.originalData["Commission Statement"],
        policyNumber: transaction.originalData["Policy Number"] || transaction.policyNumber,
        insuredName: transaction.originalData["Name of Insured"] || null,
        transactionAmount: transaction.originalData["Transaction Amount"] || transaction.transactionAmount
      })),
      webhookUrl: completionWebhookUrl, // Tell n8n where to send the completion response
      documentId: documentId // Include document ID in payload - N8N will include this in the webhook body
    };
    
    console.log('📤 Correction payload:', JSON.stringify(correctionPayload, null, 2));
    
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

export const n8nIntegrationRoutes = router;