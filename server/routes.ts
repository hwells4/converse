import type { Express } from "express";
import { createServer, type Server } from "http";

// Re-export the modular registerRoutes function
export { registerRoutes } from "./routes/index";

// Re-export all schemas that were previously defined here
export {
  presignedUrlSchema,
  lambdaInvocationSchema,
  pdfParserTriggerSchema,
} from "./schemas/request-schemas";

// For backward compatibility, also export from shared schema
export {
  insertDocumentSchema,
  updateDocumentSchema,
  insertCarrierSchema,
  webhookDocumentProcessedSchema,
  pdfParserWebhookSchema,
  n8nWebhookPayloadSchema,
  n8nCompletionWebhookSchema,
  n8nCompletionWebhookArraySchema,
} from "@shared/schema";