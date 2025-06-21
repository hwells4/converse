import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { BackendAWSService } from "../../aws-service";
import { pdfParserTriggerSchema } from "../../schemas/request-schemas";

const router = Router();

// PDF Parser service trigger endpoint
router.post("/pdf-parser/trigger", async (req, res) => {
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

// Download processed JSON data from S3
router.get("/documents/:id/processed-json", async (req, res) => {
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
router.get("/documents/:id/processed-csv", async (req, res) => {
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

export const pdfProcessingRoutes = router;