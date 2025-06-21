import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { pdfParserWebhookSchema } from "@shared/schema";

const router = Router();

// PDF Parser webhook endpoint
router.post("/pdf-parse-webhook", async (req, res) => {
  console.log('🔵 ========= WEBHOOK RECEIVED =========');
  console.log('🔵 Timestamp:', new Date().toISOString());
  console.log('🔵 Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔵 Query params:', req.query);
  console.log('🔵 =====================================');
  
  try {
    // Get document ID from query parameter (more reliable than filename matching)
    const documentId = req.query.document_id ? parseInt(req.query.document_id as string) : null;
    
    if (!documentId) {
      console.error('❌ No document_id provided in webhook URL');
      return res.status(400).json({ message: "Document ID required" });
    }
    
    const { status, csv_url, message } = pdfParserWebhookSchema.parse(req.body);
    console.log('✅ Webhook validation passed:', { status, csv_url, documentId, message });
    
    // Find the document by ID (much more reliable)
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      console.error(`❌ Document not found for ID: ${documentId}`);
      return res.status(404).json({ message: "Document not found" });
    }
    
    console.log(`📄 Found document ID ${document.id}: ${document.originalName}`);
    
    if (status === "success" && csv_url) {
      // Extract CSV S3 key from the URL
      const csvS3Key = csv_url
        .replace('https://converseinsurance.s3.us-east-2.amazonaws.com/', '')
        .replace('https://s3.amazonaws.com/converseinsurance/', '')
        .replace('https://s3-us-east-2.amazonaws.com/converseinsurance/', '');
      
      // Update document with success status and CSV location
      await storage.updateDocument(document.id, {
        status: "review_pending",
        csvS3Key: csvS3Key,
        csvUrl: csv_url,
        processedAt: new Date(),
      });
      
      console.log(`✅ Document ${document.id} updated with CSV: ${csvS3Key}`);
      
    } else if (status === "error") {
      // Update document with error status
      await storage.updateDocument(document.id, {
        status: "failed",
        processingError: message || "PDF parsing failed",
      });
      
      console.log(`❌ Document ${document.id} marked as failed: ${message}`);
    }
    
    res.json({ success: true, message: "Webhook processed successfully" });
    
  } catch (error) {
    console.error('💥 PDF parser webhook error:', error);
    
    if (error instanceof z.ZodError) {
      console.error('❌ Webhook validation errors:', JSON.stringify(error.errors, null, 2));
      console.error('❌ Received data that failed validation:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ message: "Invalid webhook data", errors: error.errors });
    }
    
    console.error('💥 Non-validation error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to process webhook",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Test webhook endpoint to verify connectivity
router.post("/test-webhook", async (req, res) => {
  console.log('🧪 TEST WEBHOOK RECEIVED');
  console.log('🧪 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🧪 Body:', JSON.stringify(req.body, null, 2));
  res.json({ success: true, message: "Test webhook received successfully", timestamp: new Date().toISOString() });
});

export const pdfParserWebhookRoutes = router;