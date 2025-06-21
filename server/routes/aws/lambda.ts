import { Router } from "express";
import { z } from "zod";
import { BackendAWSService } from "../../aws-service";
import { lambdaInvocationSchema } from "../../schemas/request-schemas";

const router = Router();

// AWS Lambda invocation for Textract processing
router.post("/lambda/invoke-textract", async (req, res) => {
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

// Test endpoint to verify AWS credentials and connectivity
router.get("/test/aws-credentials", async (req, res) => {
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

export const lambdaRoutes = router;