import { Request, Response } from "express";
import { z, ZodSchema } from "zod";

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export interface WebhookHandler<T = any> {
  name: string;
  schema?: ZodSchema<T>;
  handler: (payload: T, req: Request, res: Response) => Promise<WebhookResponse>;
}

/**
 * Standardized webhook handler that provides consistent:
 * - Request logging
 * - Payload validation
 * - Error handling
 * - Response formatting
 */
export async function handleWebhook<T>(
  webhookHandler: WebhookHandler<T>,
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();
  const webhookId = `${webhookHandler.name}-${Date.now()}`;
  
  console.log(`🔵 [${webhookId}] ========== WEBHOOK RECEIVED ==========`);
  console.log(`🔵 [${webhookId}] Name: ${webhookHandler.name}`);
  console.log(`🔵 [${webhookId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`🔵 [${webhookId}] URL: ${req.url}`);
  console.log(`🔵 [${webhookId}] Method: ${req.method}`);
  console.log(`🔵 [${webhookId}] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`🔵 [${webhookId}] Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔵 [${webhookId}] =======================================`);

  try {
    let validatedPayload: T;

    // Validate payload if schema provided
    if (webhookHandler.schema) {
      try {
        validatedPayload = webhookHandler.schema.parse(req.body);
        console.log(`✅ [${webhookId}] Payload validation passed`);
      } catch (validationError) {
        console.error(`❌ [${webhookId}] Payload validation failed:`, validationError);
        
        if (validationError instanceof z.ZodError) {
          const errorResponse: WebhookResponse = {
            success: false,
            message: "Invalid webhook payload",
            error: {
              type: "validation_error",
              details: validationError.errors,
              receivedPayload: req.body
            }
          };
          
          res.status(400).json(errorResponse);
          return;
        }
        
        throw validationError;
      }
    } else {
      validatedPayload = req.body as T;
    }

    // Execute the handler
    console.log(`🚀 [${webhookId}] Executing webhook handler...`);
    const result = await webhookHandler.handler(validatedPayload, req, res);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [${webhookId}] Handler completed successfully in ${duration}ms`);
    console.log(`✅ [${webhookId}] Result:`, JSON.stringify(result, null, 2));

    // Send success response
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${webhookId}] Handler failed after ${duration}ms:`, error);

    const errorResponse: WebhookResponse = {
      success: false,
      message: "Webhook processing failed",
      error: {
        type: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      }
    };

    res.status(500).json(errorResponse);
  }
}

/**
 * Utility to create a standardized webhook handler
 */
export function createWebhookHandler<T>(
  name: string,
  handler: (payload: T, req: Request, res: Response) => Promise<WebhookResponse>,
  schema?: ZodSchema<T>
): WebhookHandler<T> {
  return {
    name,
    schema,
    handler
  };
}

/**
 * Middleware to log all webhook requests for debugging
 */
export function webhookDebugLogger(req: Request, res: Response, next: Function) {
  if (req.path.includes('/webhook/')) {
    console.log(`🔍 [DEBUG] Webhook request: ${req.method} ${req.path}`);
    console.log(`🔍 [DEBUG] Headers:`, req.headers);
    console.log(`🔍 [DEBUG] Body:`, req.body);
  }
  next();
}