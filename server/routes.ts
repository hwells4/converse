import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDocumentSchema, updateDocumentSchema, insertCarrierSchema, webhookDocumentProcessedSchema, pdfParserWebhookSchema, n8nWebhookPayloadSchema, n8nCompletionWebhookSchema, n8nCompletionWebhookArraySchema } from "@shared/schema";
import { BackendAWSService } from "./aws-service";
import { z } from "zod";

// Validation schemas for new endpoints
const presignedUrlSchema = z.object({
  carrierId: z.number().positive(),
  filename: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  contentType: z.string().min(1),
});

const lambdaInvocationSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  carrierId: z.number().positive(),
});

const pdfParserTriggerSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  carrierId: z.number().positive(),
  documentId: z.number().positive(),
});



export async function registerRoutes(app: Express): Promise<Server> {
  // Carrier management endpoints
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getCarriers();
      res.json(carriers);
    } catch (error) {
      console.error("Failed to fetch carriers:", error);
      res.status(500).json({ message: "Failed to fetch carriers" });
    }
  });

  app.get("/api/carriers/:id", async (req, res) => {
    try {
      const carrierId = parseInt(req.params.id);
      if (isNaN(carrierId)) {
        return res.status(400).json({ message: "Invalid carrier ID" });
      }
      
      const carrier = await storage.getCarrier(carrierId);
      if (!carrier) {
        return res.status(404).json({ message: "Carrier not found" });
      }
      
      res.json(carrier);
    } catch (error) {
      console.error("Failed to fetch carrier:", error);
      res.status(500).json({ message: "Failed to fetch carrier" });
    }
  });

  app.post("/api/carriers", async (req, res) => {
    try {
      const carrierData = insertCarrierSchema.parse(req.body);
      const carrier = await storage.createCarrier(carrierData);
      res.status(201).json(carrier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid carrier data", errors: error.errors });
      }
      console.error("Failed to create carrier:", error);
      res.status(500).json({ message: "Failed to create carrier" });
    }
  });

  // AWS S3 presigned URL generation
  app.post("/api/s3/presigned-upload-url", async (req, res) => {
    console.log('🔵 Received presigned URL request');
    console.log('🔵 Request body:', req.body);
    console.log('🔵 Request headers:', req.headers);
    
    try {
      const { carrierId, filename, documentType, contentType } = presignedUrlSchema.parse(req.body);
      console.log('✅ Request validation passed:', { carrierId, filename, documentType, contentType });
      
      if (!BackendAWSService.isConfigured()) {
        console.error('❌ AWS credentials not configured');
        return res.status(500).json({ message: "AWS credentials not configured" });
      }
      console.log('✅ AWS credentials are configured');

      console.log('🔄 Generating presigned URL...');
      const result = await BackendAWSService.generatePresignedUrl({
        carrierId,
        filename,
        documentType,
        contentType,
      });
      console.log('✅ Presigned URL generated successfully:', {
        s3Key: result.s3Key,
        uploadUrlLength: result.uploadUrl?.length,
        s3Url: result.s3Url
      });

      res.json(result);
    } catch (error) {
      console.error('💥 Presigned URL generation error:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof z.ZodError) {
        console.error('❌ Validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Presigned URL generation error:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // AWS Lambda invocation for Textract processing
  app.post("/api/lambda/invoke-textract", async (req, res) => {
    console.log('🔵 Received Lambda invocation request');
    console.log('🔵 Request body:', req.body);
    console.log('🔵 Request headers:', req.headers);
    
    try {
      const { s3Key, documentType, carrierId } = lambdaInvocationSchema.parse(req.body);
      console.log('✅ Lambda request validation passed:', { s3Key, documentType, carrierId });
      
      if (!BackendAWSService.isConfigured()) {
        console.error('❌ AWS credentials not configured for Lambda');
        return res.status(500).json({ message: "AWS credentials not configured" });
      }
      console.log('✅ AWS credentials are configured for Lambda');

      console.log('🔄 Invoking Lambda function...');
      const jobId = await BackendAWSService.invokeLambda({
        s3Key,
        documentType,
        carrierId,
      });
      console.log('✅ Lambda invocation successful, jobId:', jobId);

      res.json({ jobId, status: "processing" });
    } catch (error) {
      console.error('💥 Lambda invocation error:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof z.ZodError) {
        console.error('❌ Lambda validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Lambda invocation error:", error);
      res.status(500).json({ message: "Failed to start document processing" });
    }
  });

  // PDF Parser service trigger endpoint
  app.post("/api/pdf-parser/trigger", async (req, res) => {
    console.log('🔵 Received PDF parser trigger request');
    console.log('🔵 Request body:', req.body);
    
    try {
      const { s3Key, documentType, carrierId, documentId } = pdfParserTriggerSchema.parse(req.body);
      console.log('✅ PDF parser request validation passed:', { s3Key, documentType, carrierId, documentId });
      
      // Construct webhook URL - force HTTPS for external services
      const protocol = req.get('host')?.includes('replit.dev') ? 'https' : req.protocol;
      const webhookUrl = `${protocol}://${req.get('host')}/api/pdf-parse-webhook`;
      console.log('🔗 Webhook URL:', webhookUrl);
      
      // Prepare request payload for Railway PDF parser service
      const parserPayload = {
        s3_bucket: "converseinsurance",
        s3_key: s3Key,
        webhook_url: `${webhookUrl}?document_id=${documentId}`,
        document_id: documentId
      };
      
      console.log('📤 Sending request to PDF parser service:', parserPayload);
      
      // Send request to Railway PDF parser service with API key authentication
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        console.error('❌ API_KEY environment variable not set');
        throw new Error('API key not configured for PDF parser service');
      }

      const response = await fetch('https://pdfparser-production-f216.up.railway.app/parse-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(parserPayload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ PDF parser service error:', errorText);
        
        if (response.status === 401) {
          console.error('❌ Authentication failed - invalid API key');
          throw new Error('PDF parser service authentication failed - invalid API key');
        }
        
        throw new Error(`PDF parser service error: ${response.status} ${errorText}`);
      }
      
      console.log('✅ PDF parser service request successful');
      res.json({ status: "parsing_started" });
      
    } catch (error) {
      console.error('💥 PDF parser trigger error:', error);
      
      if (error instanceof z.ZodError) {
        console.error('❌ PDF parser validation errors:', error.errors);
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("PDF parser trigger error:", error);
      res.status(500).json({ message: "Failed to start PDF parsing" });
    }
  });

  // Test webhook endpoint to verify connectivity
  app.post("/api/test-webhook", async (req, res) => {
    console.log('🧪 TEST WEBHOOK RECEIVED');
    console.log('🧪 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🧪 Body:', JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: "Test webhook received successfully", timestamp: new Date().toISOString() });
  });

  // Simple test to verify correction webhook route exists
  app.get("/api/webhook/n8n-correction-completion", async (req, res) => {
    res.json({ 
      message: "N8N correction completion webhook endpoint exists", 
      method: "POST expected",
      timestamp: new Date().toISOString()
    });
  });

  // PDF Parser webhook endpoint
  app.post("/api/pdf-parse-webhook", async (req, res) => {
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

  // Download processed JSON data from S3
  app.get("/api/documents/:id/processed-json", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔵 Fetching processed JSON for document ID: ${id}`);
      
      const document = await storage.getDocument(id);
      console.log(`📄 Document found:`, {
        id: document?.id,
        filename: document?.filename,
        status: document?.status,
        jsonS3Key: document?.jsonS3Key,
        csvS3Key: document?.csvS3Key
      });
      
      if (!document) {
        console.log(`❌ Document ${id} not found`);
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.jsonS3Key) {
        console.log(`❌ Document ${id} has no jsonS3Key`);
        return res.status(404).json({ message: "Processed JSON not available" });
      }

      if (!BackendAWSService.isConfigured()) {
        console.log(`❌ AWS credentials not configured`);
        return res.status(500).json({ message: "AWS credentials not configured" });
      }

      console.log(`☁️ Downloading JSON from S3 key: ${document.jsonS3Key}`);
      const jsonContent = await BackendAWSService.downloadFromS3(document.jsonS3Key);
      console.log(`📥 Downloaded JSON content length: ${jsonContent.length} characters`);
      console.log(`📥 JSON content preview (first 200 chars): ${jsonContent.substring(0, 200)}...`);
      
      const parsedData = JSON.parse(jsonContent);
      console.log(`✅ JSON parsed successfully. Keys:`, Object.keys(parsedData));
      console.log(`✅ Tables count:`, parsedData.tables?.length || 0);
      console.log(`✅ Key-value pairs count:`, parsedData.keyValuePairs?.length || 0);
      console.log(`✅ Raw lines count:`, parsedData.rawLines?.length || 0);

      res.json(parsedData);
    } catch (error) {
      console.error("💥 JSON download error:", error);
      console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch processed data" });
    }
  });

  // Download processed CSV data from S3
  app.get("/api/documents/:id/processed-csv", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.csvS3Key) {
        return res.status(404).json({ message: "Processed CSV not available" });
      }

      if (!BackendAWSService.isConfigured()) {
        return res.status(500).json({ message: "AWS credentials not configured" });
      }

      const csvContent = await BackendAWSService.downloadFromS3(document.csvS3Key);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName.replace('.pdf', '.csv')}"`);
      res.send(csvContent);
    } catch (error) {
      console.error("CSV download error:", error);
      res.status(500).json({ message: "Failed to download CSV file" });
    }
  });

  // Get CSV data (either processed from PDF or directly uploaded CSV)
  app.get("/api/documents/:id/csv-data", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔵 Fetching CSV data for document ID: ${id}`);
      
      const document = await storage.getDocument(id);
      console.log(`📄 Document found:`, {
        id: document?.id,
        filename: document?.filename,
        status: document?.status,
        csvS3Key: document?.csvS3Key,
        s3Key: document?.s3Key
      });
      
      if (!document) {
        console.log(`❌ Document ${id} not found`);
        return res.status(404).json({ message: "Document not found" });
      }

      if (!BackendAWSService.isConfigured()) {
        console.log(`❌ AWS credentials not configured`);
        return res.status(500).json({ message: "AWS credentials not configured" });
      }

      let csvContent: string;

      // Check if this is a processed PDF (has csvS3Key) or direct CSV upload
      if (document.csvS3Key) {
        console.log(`☁️ Downloading processed CSV from S3 key: ${document.csvS3Key}`);
        csvContent = await BackendAWSService.downloadFromS3(document.csvS3Key);
      } else if (document.s3Key && (document.originalName?.endsWith('.csv') || document.filename.includes('.csv'))) {
        console.log(`☁️ Downloading direct CSV upload from S3 key: ${document.s3Key}`);
        csvContent = await BackendAWSService.downloadFromS3(document.s3Key);
      } else {
        console.log(`❌ Document ${id} has no CSV data available`);
        console.log(`📋 Document details: originalName=${document.originalName}, filename=${document.filename}, s3Key=${document.s3Key}`);
        return res.status(404).json({ message: "CSV data not available for this document" });
      }

      console.log(`📥 Downloaded CSV content length: ${csvContent.length} characters`);
      
      // Parse CSV content into JSON
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        return res.json({ headers: [], rows: [] });
      }
      
      // Parse CSV manually (simple approach)
      const parseCSVLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        return values.map(value => ({
          value: value.replace(/^"|"$/g, ''), // Remove surrounding quotes
          confidence: 100 // CSV doesn't have confidence scores
        }));
      });
      
      console.log(`✅ CSV parsed successfully. Headers:`, headers);
      console.log(`✅ Rows count:`, rows.length);

      res.json({ headers, rows });
    } catch (error) {
      console.error("💥 CSV data fetch error:", error);
      console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch CSV data" });
    }
  });

  // Generate download URL for files (presigned URL)
  app.post("/api/s3/download-url", async (req, res) => {
    try {
      const { s3Key } = z.object({ s3Key: z.string().min(1) }).parse(req.body);
      
      if (!BackendAWSService.isConfigured()) {
        return res.status(500).json({ message: "AWS credentials not configured" });
      }

      const downloadUrl = await BackendAWSService.generateDownloadUrl(s3Key);
      res.json({ downloadUrl });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Download URL generation error:", error);
      res.status(500).json({ message: "Failed to generate download URL" });
    }
  });

  // Get all documents
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get single document
  app.get("/api/documents/:id", async (req, res) => {
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
  app.post("/api/documents", async (req, res) => {
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
  app.patch("/api/documents/:id", async (req, res) => {
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
  app.delete("/api/documents/:id", async (req, res) => {
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
  app.get("/api/documents/status/:status", async (req, res) => {
    try {
      const { status } = req.params;
      const documents = await storage.getDocumentsByStatus(status);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents by status" });
    }
  });

  // Enhanced webhook endpoint for AWS Lambda to update document status
  app.post("/api/webhook/document-processed", async (req, res) => {
    console.log('🔵 Received document processing webhook');
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔵 Request headers:', req.headers);
    
    try {
      // Step 0: Enhanced security validation for Lambda webhook
      const userAgent = req.headers['user-agent'];
      const receivedSecret = req.headers['x-webhook-secret'];
      const EXPECTED_LAMBDA_WEBHOOK_SECRET = process.env.LAMBDA_WEBHOOK_SECRET;
      
      // Validate webhook secret if configured on the server
      if (EXPECTED_LAMBDA_WEBHOOK_SECRET) {
        if (receivedSecret !== EXPECTED_LAMBDA_WEBHOOK_SECRET) {
          console.warn("Webhook received with invalid or missing secret.");
          return res.status(403).json({ 
            success: false,
            message: "Forbidden: Invalid webhook secret" 
          });
        }
        console.log("Webhook secret validated successfully.");
      } else {
        console.warn("LAMBDA_WEBHOOK_SECRET not configured on server. Skipping secret validation (less secure).");
      }
      
      // Validate User-Agent (basic check for AWS Lambda)
      if (!userAgent || (!userAgent.includes('aws-lambda') && !userAgent.includes('Amazon') && !userAgent.includes('textract'))) {
        console.warn('⚠️ Suspicious user-agent for webhook:', userAgent);
        // Don't block completely as AWS might change user-agent, but log it
      }
      
      // Validate Content-Type
      if (req.headers['content-type'] !== 'application/json') {
        console.error('❌ Invalid content-type:', req.headers['content-type']);
        return res.status(400).json({ 
          success: false,
          message: "Invalid content-type. Expected application/json" 
        });
      }
      
      console.log('✅ Security validation passed');

      // Step 1: Validate webhook payload according to FR005 specification
      const validatedPayload = webhookDocumentProcessedSchema.parse(req.body);
      console.log('✅ Webhook payload validation passed');
      
      // Step 2: Find corresponding document record using s3Key
      const document = await storage.getDocumentByS3Key(validatedPayload.s3Key);
      if (!document) {
        console.error('❌ Document not found for s3Key:', validatedPayload.s3Key);
        return res.status(404).json({ 
          success: false,
          message: "Document not found",
          s3Key: validatedPayload.s3Key
        });
      }
      console.log('✅ Found document:', { id: document.id, filename: document.filename });

      // Step 3: Prepare update data based on processing status
      const updates: any = {
        textractJobId: validatedPayload.textractJobId,
        processedAt: new Date(), // Set processedAt timestamp in the handler, not from Lambda
      };

      // Step 4: Handle successful processing
      if (validatedPayload.status === "processed") {
        updates.status = "review_pending"; // Set to review_pending as per FR005
        updates.jsonS3Key = validatedPayload.jsonS3Key;
        updates.jsonUrl = validatedPayload.jsonUrl;
        
        // CSV fields are optional
        if (validatedPayload.csvS3Key) {
          updates.csvS3Key = validatedPayload.csvS3Key;
        }
        if (validatedPayload.csvUrl) {
          updates.csvUrl = validatedPayload.csvUrl;
        }
        
        // Clear any previous processing errors
        updates.processingError = null;
        
        console.log('✅ Processing successful, setting status to review_pending');
      } 
      // Step 5: Handle failed processing
      else if (validatedPayload.status === "failed") {
        updates.status = "failed";
        updates.processingError = validatedPayload.errorMessage || "Processing failed without specific error message";
        
        console.log('❌ Processing failed:', updates.processingError);
      }

      // Step 6: Add metadata if provided
      if (validatedPayload.metadata) {
        updates.metadata = validatedPayload.metadata;
      }

      // Step 7: Update document record in database
      const updatedDocument = await storage.updateDocument(document.id, updates);
      
      if (!updatedDocument) {
        console.error('❌ Failed to update document in database');
        return res.status(500).json({ 
          success: false,
          message: "Failed to update document record" 
        });
      }

      console.log('✅ Document updated successfully:', {
        id: updatedDocument.id,
        status: updatedDocument.status,
        textractJobId: updatedDocument.textractJobId
      });

      // Step 8: Return success response
      res.json({
        success: true,
        message: "Document processing status updated successfully",
        document: {
          id: updatedDocument.id,
          status: updatedDocument.status,
          textractJobId: updatedDocument.textractJobId,
          processedAt: updatedDocument.processedAt
        }
      });

    } catch (error) {
      console.error('💥 Webhook processing error:', error);
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        console.error('❌ Webhook payload validation failed:', error.errors);
        return res.status(400).json({ 
          success: false,
          message: "Invalid webhook payload", 
          errors: error.errors,
          receivedPayload: req.body
        });
      }
      
      // Handle database errors
      if (error instanceof Error && error.message.includes('database')) {
        console.error('❌ Database error during webhook processing:', error.message);
        return res.status(500).json({ 
          success: false,
          message: "Database error during webhook processing",
          error: error.message
        });
      }
      
      // Handle general errors
      console.error('❌ Unexpected error during webhook processing:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // N8N completion webhook endpoint
  app.post("/api/webhook/n8n-completion", async (req, res) => {
    console.log('🔵 Received N8N completion webhook');
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔵 Request headers:', req.headers);
    
    try {
      // Handle both array and single object formats
      let payloadArray: any[];
      
      // Check if the webhook has a 'results' array (new format)
      if (req.body && req.body.results && Array.isArray(req.body.results)) {
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

  // Test endpoint to verify AWS credentials and connectivity
  app.get("/api/test/aws-credentials", async (req, res) => {
    try {
      const testResults = {
        credentialsConfigured: false,
        s3Access: false,
        lambdaAccess: false,
        environment: {
          AWS_REGION: process.env.AWS_REGION || "not set",
          AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || "not set",
          AWS_TEXTRACT_LAMBDA_FUNCTION: process.env.AWS_TEXTRACT_LAMBDA_FUNCTION || "not set",
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "set" : "not set",
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? "set" : "not set",
        },
        errors: [] as string[]
      };

      // Check if credentials are configured
      testResults.credentialsConfigured = BackendAWSService.isConfigured();
      
      if (!testResults.credentialsConfigured) {
        testResults.errors.push("AWS credentials not configured in environment variables");
        return res.json(testResults);
      }

      // Test S3 access by trying to generate a presigned URL
      try {
        const testResult = await BackendAWSService.generatePresignedUrl({
          carrierId: 1,
          filename: "test.pdf",
          documentType: "commission",
          contentType: "application/pdf"
        });
        testResults.s3Access = !!(testResult.uploadUrl && testResult.s3Key);
      } catch (error) {
        testResults.errors.push(`S3 access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test Lambda access (just validate credentials, don't actually invoke)
      try {
        // We'll just check if we can create the lambda client without errors
        // A full test would require invoking the function which we don't want for a test endpoint
        if (process.env.AWS_TEXTRACT_LAMBDA_FUNCTION) {
          testResults.lambdaAccess = true;
        } else {
          testResults.errors.push("AWS_TEXTRACT_LAMBDA_FUNCTION not configured");
        }
      } catch (error) {
        testResults.errors.push(`Lambda access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      res.json({
        ...testResults,
        status: testResults.credentialsConfigured && testResults.s3Access ? "success" : "error",
        message: testResults.errors.length === 0 ? "AWS credentials are properly configured and working" : "AWS configuration issues detected"
      });

    } catch (error) {
      console.error("AWS credentials test failed:", error);
      res.status(500).json({ 
        status: "error",
        message: "Failed to test AWS credentials",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Test endpoint to simulate webhook calls for testing purposes
  app.post("/api/test/webhook-simulation", async (req, res) => {
    console.log('🧪 Test webhook simulation endpoint called');
    
    try {
      const { s3Key, simulateStatus = "processed" } = req.body;
      
      if (!s3Key) {
        return res.status(400).json({ 
          success: false,
          message: "s3Key is required for webhook simulation" 
        });
      }

      // Find the document to get its details
      const document = await storage.getDocumentByS3Key(s3Key);
      if (!document) {
        return res.status(404).json({ 
          success: false,
          message: "Document not found for simulation",
          s3Key 
        });
      }

      // Create a simulated webhook payload
      const simulatedPayload = {
        s3Key,
        textractJobId: `test-job-${Date.now()}`,
        status: simulateStatus,
        ...(simulateStatus === "processed" ? {
          jsonS3Key: `processed/${s3Key.replace('uploads/', '').replace('.pdf', '.json')}`,
          jsonUrl: `https://s3.amazonaws.com/bucket/processed/${s3Key.replace('uploads/', '').replace('.pdf', '.json')}`,
          csvS3Key: `processed/${s3Key.replace('uploads/', '').replace('.pdf', '.csv')}`,
          csvUrl: `https://s3.amazonaws.com/bucket/processed/${s3Key.replace('uploads/', '').replace('.pdf', '.csv')}`,
        } : {
          errorMessage: "Simulated processing failure for testing"
        })
      };

      console.log('🧪 Simulated webhook payload:', simulatedPayload);

      // Make internal call to the webhook endpoint
      const webhookResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/document-processed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aws-lambda-test-simulation',
          ...(process.env.LAMBDA_WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.LAMBDA_WEBHOOK_SECRET } : {})
        },
        body: JSON.stringify(simulatedPayload)
      });

      const webhookResult = await webhookResponse.json();

      res.json({
        success: true,
        message: "Webhook simulation completed",
        simulatedPayload,
        webhookResponse: {
          status: webhookResponse.status,
          result: webhookResult
        }
      });

    } catch (error) {
      console.error('💥 Webhook simulation error:', error);
      res.status(500).json({ 
        success: false,
        message: "Webhook simulation failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Upload processed CSV to S3 for N8N consumption
  app.post("/api/s3/upload-processed-csv", async (req, res) => {
    try {
      const { csvData, fileName, carrierId, documentId } = req.body;
      
      if (!csvData || !fileName || !carrierId) {
        return res.status(400).json({ 
          success: false, 
          message: "csvData, fileName, and carrierId are required" 
        });
      }

      if (!BackendAWSService.isConfigured()) {
        return res.status(500).json({ 
          success: false, 
          message: "AWS credentials not configured" 
        });
      }

      // Generate S3 key for processed CSV
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const s3Key = `processed-csv/${new Date().toISOString().split('T')[0]}_carrier-${carrierId}_${sanitizedFileName}_${timestamp}.csv`;

      // Convert array data back to CSV format with headers
      let csvContent = '';
      
      if (csvData.length > 0) {
        // Extract headers from the first row (excluding internal fields like _originalIndex)
        const headers = Object.keys(csvData[0]).filter(key => !key.startsWith('_'));
        const headerRow = headers.map(header => 
          typeof header === 'string' && header.includes(',') ? `"${header}"` : header
        ).join(',');
        
        // Create data rows
        const dataRows = csvData.map((row: any) => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        );
        
        csvContent = [headerRow, ...dataRows].join('\n');
      }

      // Upload to S3
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key,
        Body: csvContent,
        ContentType: 'text/csv',
      });

      await s3Client.send(uploadCommand);

      const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

      console.log(`✅ Processed CSV uploaded to S3: ${s3Key}`);

      res.json({
        success: true,
        message: "CSV uploaded to S3 successfully",
        csvS3Key: s3Key,
        csvUrl: s3Url
      });

    } catch (error) {
      console.error('💥 CSV S3 upload error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to upload CSV to S3",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // N8N webhook endpoint for Salesforce upload
  app.post("/api/n8n/salesforce-upload", async (req, res) => {
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
  app.post("/api/n8n/salesforce-status", async (req, res) => {
    console.log('🔵 N8N status callback received');
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const { documentId, status, message } = req.body;
      
      if (!documentId || !status) {
        return res.status(400).json({ 
          success: false,
          message: "documentId and status are required" 
        });
      }

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
  app.post("/api/documents/:id/resubmit-failed-transactions", async (req, res) => {
    console.log('🔵 Received failed transactions resubmission request');
    console.log('🔵 Document ID:', req.params.id);
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const { correctedTransactions } = req.body;
      
      if (!correctedTransactions || !Array.isArray(correctedTransactions)) {
        return res.status(400).json({ message: "Invalid corrected transactions data" });
      }
      
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
        console.log('📡 N8N Response Headers:', [...n8nResponse.headers.entries()]);
        
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

  // N8N correction completion webhook endpoint
  app.post("/api/webhook/n8n-correction-completion", async (req, res) => {
    console.log('🔵 ========== CORRECTION WEBHOOK RECEIVED ==========');
    console.log('🔵 Timestamp:', new Date().toISOString());
    console.log('🔵 URL hit:', req.url);
    console.log('🔵 Method:', req.method);
    console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔵 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔵 ====================================');
    
    try {
      // Get document ID from request body (same pattern as your working webhook)
      const documentId = req.body.documentId || req.body.document?.id;
      
      if (!documentId) {
        console.error('❌ No documentId provided in webhook body');
        return res.status(400).json({ 
          success: false,
          message: "Document ID required in request body" 
        });
      }
      
      console.log(`📄 Processing correction results for document ${documentId}`);
      
      // Handle the correction webhook format: { totalProcessed, successCount, failureCount, results: { successful: [...], failed: [...] }, documentId }
      const { totalProcessed, successCount, failureCount, results, summary } = req.body;
      
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
      
      // Update cumulative success/failure counts
      const previousSuccessful = currentCompletionData.numberOfSuccessful || 0;
      const newSuccessfulCount = previousSuccessful + successCount;
      const totalTransactions = currentCompletionData.totalTransactions || 0;
      
      console.log(`📊 Progress update: ${previousSuccessful} + ${successCount} = ${newSuccessfulCount}/${totalTransactions}`);
      
      // Remove successfully corrected transactions from failed list
      const updatedFailedTransactions = (currentCompletionData.failedTransactions || []).filter((failedTx: any) => {
        const wasSuccessful = (results.successful || []).some((successfulResult: any) => {
          const txPolicyNumber = successfulResult.policyNumber;
          const failedPolicyNumber = failedTx.policyNumber || failedTx.originalData?.["Policy Number"];
          return txPolicyNumber === failedPolicyNumber;
        });
        return !wasSuccessful;
      });
      
      // Add any new failures from this correction attempt
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
      
      // Combine existing failed transactions with new failures
      const allFailedTransactions = [...updatedFailedTransactions, ...newFailedTransactions];
      
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
      console.log('📝 Updated failed transactions count:', updatedFailedTransactions.length);
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

  // Helper function to process N8N correction results (used by both direct response and webhook)
  async function processN8NCorrectionResults(documentId: number, correctionData: any) {
    const { totalProcessed, successCount, failureCount, results, summary } = correctionData;
    
    console.log('🔄 UPDATING DATABASE...');
    console.log('📝 Document ID:', documentId);
    console.log('📝 Success count:', successCount);
    console.log('📝 Failure count:', failureCount);
    
    // Get current document state
    const document = await storage.getDocument(documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    const currentMetadata = document.metadata as any;
    const currentCompletionData = currentMetadata?.completionData || {};
    
    // Update cumulative success/failure counts
    const newSuccessfulCount = (currentCompletionData.numberOfSuccessful || 0) + successCount;
    const totalTransactions = currentCompletionData.totalTransactions || 0;
    
    // Remove successfully corrected transactions from failed list
    const updatedFailedTransactions = (currentCompletionData.failedTransactions || []).filter((failedTx: any) => {
      const wasSuccessful = results.successful?.some((successfulResult: any) => {
        const txPolicyNumber = successfulResult.transaction?.policyNumber;
        const failedPolicyNumber = failedTx.policyNumber || failedTx.originalData?.["Policy Number"];
        return txPolicyNumber === failedPolicyNumber;
      });
      return !wasSuccessful;
    });
    
    // Add any new failures from this correction attempt
    const newFailedTransactions = (results.failed || []).map((failedResult: any) => ({
      type: "policy_not_found",
      error: failedResult.message || failedResult.error,
      insuredName: failedResult.originalData?.insuredName,
      statementId: failedResult.originalData?.statementId,
      originalData: {
        "Policy Name": null,
        "Policy Number": failedResult.originalData?.policyNumber,
        "Name of Insured": failedResult.originalData?.insuredName,
        "Transaction Type": null,
        "Transaction Amount": failedResult.originalData?.transactionAmount,
        "Commission Statement": failedResult.originalData?.statementId
      },
      policyNumber: failedResult.originalData?.policyNumber,
      transactionAmount: failedResult.originalData?.transactionAmount,
      commissionStatementId: failedResult.originalData?.statementId
    }));
    
    const allFailedTransactions = [...updatedFailedTransactions, ...newFailedTransactions];
    const allTransactionsSuccessful = newSuccessfulCount === totalTransactions && allFailedTransactions.length === 0;
    const finalStatus = allTransactionsSuccessful ? "completed" : "completed_with_errors";
    
    console.log('📝 New Status:', finalStatus);
    console.log('📝 Updated failed transactions count:', allFailedTransactions.length);
    
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
          summary
        }
      ]
    };
    
    await storage.updateDocument(documentId, {
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
    
    return { finalStatus, newSuccessfulCount, totalTransactions, allFailedTransactions };
  }

  // Debug route to catch any webhook attempts
  app.all("/api/webhook/*", (req, res, next) => {
    console.log(`🔍 WEBHOOK DEBUG: ${req.method} ${req.url}`);
    console.log(`🔍 Headers:`, req.headers);
    console.log(`🔍 Body:`, req.body);
    next(); // Continue to actual route handler
  });

  const httpServer = createServer(app);
  return httpServer;
}
