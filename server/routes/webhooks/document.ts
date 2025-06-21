import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { webhookDocumentProcessedSchema } from "@shared/schema";
import { validateLambdaWebhook } from "../../utils/webhook-security";

const router = Router();

// Enhanced webhook endpoint for AWS Lambda to update document status
router.post("/webhook/document-processed", async (req, res) => {
  console.log('🔵 Received document processing webhook');
  console.log('🔵 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔵 Request headers:', req.headers);
  
  try {
    // Step 0: Enhanced security validation for Lambda webhook
    const securityCheck = validateLambdaWebhook(req);
    if (!securityCheck.isValid) {
      return res.status(403).json({ 
        success: false,
        message: `Forbidden: ${securityCheck.error}` 
      });
    }

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

export const documentWebhookRoutes = router;