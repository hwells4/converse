import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { webhookSimulationSchema } from "../../schemas/request-schemas";

const router = Router();

// Test endpoint to simulate webhook calls for testing purposes
router.post("/test/webhook-simulation", async (req, res) => {
  console.log('🧪 Test webhook simulation endpoint called');
  
  try {
    const { s3Key, simulateStatus = "processed" } = webhookSimulationSchema.parse(req.body);

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

// N8N webhook testing utilities
router.post("/test/n8n-completion", async (req, res) => {
  console.log('🧪 Testing N8N completion webhook');
  
  const testPayload = {
    documentId: req.body.documentId || 1,
    status: req.body.status || "completed_with_errors",
    completionData: {
      carrierName: "Test Carrier",
      numberOfSuccessful: req.body.numberOfSuccessful || 8,
      totalTransactions: req.body.totalTransactions || 10,
      failedTransactions: req.body.failedTransactions || [
        { policyNumber: "TEST-001", error: "Policy not found" },
        { policyNumber: "TEST-002", error: "Policy not found" }
      ],
      message: "Test completion message",
      completedAt: new Date().toISOString()
    }
  };

  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/n8n-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    res.json({
      success: true,
      message: "N8N completion webhook test completed",
      testPayload,
      response: {
        status: response.status,
        result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "N8N completion webhook test failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/test/n8n-correction", async (req, res) => {
  console.log('🧪 Testing N8N correction webhook');
  
  const testPayload = {
    documentId: req.body.documentId || 1,
    totalProcessed: req.body.totalProcessed || 2,
    successCount: req.body.successCount || 1,
    failureCount: req.body.failureCount || 1,
    results: {
      successful: [
        { policyNumber: "TEST-001", amount: 100 }
      ],
      failed: [
        { 
          policyNumber: "TEST-002", 
          error: "Policy not found",
          originalData: {
            policyNumber: "TEST-002",
            insuredName: "Test Insured",
            transactionAmount: 200,
            statementId: "STMT-001"
          }
        }
      ]
    },
    summary: "Test correction summary"
  };

  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhook/n8n-correction-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    res.json({
      success: true,
      message: "N8N correction webhook test completed",
      testPayload,
      response: {
        status: response.status,
        result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "N8N correction webhook test failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// List all available webhook endpoints
router.get("/test/webhook-endpoints", (req, res) => {
  res.json({
    success: true,
    message: "Available webhook endpoints",
    endpoints: [
      {
        path: "/api/webhook/n8n-completion",
        method: "POST",
        description: "N8N completion webhook",
        testEndpoint: "/api/test/n8n-completion"
      },
      {
        path: "/api/webhook/n8n-correction-completion", 
        method: "POST",
        description: "N8N correction completion webhook",
        testEndpoint: "/api/test/n8n-correction"
      },
      {
        path: "/api/webhook/document-processed",
        method: "POST", 
        description: "Document processing webhook",
        testEndpoint: "/api/test/webhook-simulation"
      }
    ]
  });
});

// Debug route to catch any webhook attempts
router.all("/webhook/*", (req, res, next) => {
  console.log(`🔍 WEBHOOK DEBUG: ${req.method} ${req.url}`);
  console.log(`🔍 Headers:`, req.headers);
  console.log(`🔍 Body:`, req.body);
  next(); // Continue to actual route handler
});

export const debugRoutes = router;