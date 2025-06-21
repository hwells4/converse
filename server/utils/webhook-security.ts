import { Request } from "express";

export interface WebhookSecurityResult {
  isValid: boolean;
  error?: string;
}

export function validateLambdaWebhook(req: Request): WebhookSecurityResult {
  // Validate webhook secret if configured on the server
  const receivedSecret = req.headers['x-webhook-secret'];
  const EXPECTED_LAMBDA_WEBHOOK_SECRET = process.env.LAMBDA_WEBHOOK_SECRET;
  
  if (EXPECTED_LAMBDA_WEBHOOK_SECRET) {
    if (receivedSecret !== EXPECTED_LAMBDA_WEBHOOK_SECRET) {
      console.warn("Webhook received with invalid or missing secret.");
      return { isValid: false, error: "Invalid webhook secret" };
    }
    console.log("Webhook secret validated successfully.");
  } else {
    console.warn("LAMBDA_WEBHOOK_SECRET not configured on server. Skipping secret validation (less secure).");
  }
  
  // Validate User-Agent (basic check for AWS Lambda)
  const userAgent = req.headers['user-agent'];
  if (!userAgent || (!userAgent.includes('aws-lambda') && !userAgent.includes('Amazon') && !userAgent.includes('textract'))) {
    console.warn('⚠️ Suspicious user-agent for webhook:', userAgent);
    // Don't block completely as AWS might change user-agent, but log it
  }
  
  // Validate Content-Type
  if (req.headers['content-type'] !== 'application/json') {
    console.error('❌ Invalid content-type:', req.headers['content-type']);
    return { isValid: false, error: "Invalid content-type. Expected application/json" };
  }
  
  console.log('✅ Security validation passed');
  return { isValid: true };
}