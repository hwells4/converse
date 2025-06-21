import type { Express } from "express";
import { createServer, type Server } from "http";

// Import route modules
import { carrierRoutes } from "./carriers";
import { documentRoutes } from "./documents";
import { documentStatusRoutes } from "./documents-status";
import { s3Routes } from "./aws/s3";
import { lambdaRoutes } from "./aws/lambda";
import { pdfProcessingRoutes } from "./processing/pdf";
import { csvProcessingRoutes } from "./processing/csv";
import { pdfParserWebhookRoutes } from "./webhooks/pdf-parser";
import { documentWebhookRoutes } from "./webhooks/document";
import { n8nUnifiedWebhookRoutes } from "./webhooks/n8n-unified";
import { n8nIntegrationRoutes } from "./integrations/n8n";
import { debugRoutes } from "./debug/test";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register route modules
  app.use("/api", carrierRoutes);
  app.use("/api", documentRoutes);
  app.use("/api", documentStatusRoutes);
  app.use("/api", s3Routes);
  app.use("/api", lambdaRoutes);
  app.use("/api", pdfProcessingRoutes);
  app.use("/api", csvProcessingRoutes);
  app.use("/api", pdfParserWebhookRoutes);
  app.use("/api", documentWebhookRoutes);
  app.use("/api", n8nUnifiedWebhookRoutes);
  app.use("/api", n8nIntegrationRoutes);
  app.use("/api", debugRoutes);

  const httpServer = createServer(app);
  return httpServer;
}