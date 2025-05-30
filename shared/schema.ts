import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Carriers table for managing insurance carriers
export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  documentType: text("document_type").notNull(), // 'commission' or 'renewal'
  carrierId: integer("carrier_id").references(() => carriers.id), // Reference to carrier
  s3Key: text("s3_key").notNull(),
  s3Url: text("s3_url"),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("uploaded"), // 'uploaded', 'processing', 'processed', 'failed', 'review_pending', 'salesforce_upload_pending', 'completed'
  textractJobId: text("textract_job_id"),
  csvS3Key: text("csv_s3_key"),
  csvUrl: text("csv_url"),
  jsonS3Key: text("json_s3_key"), // New field for JSON output with confidence scores
  jsonUrl: text("json_url"),      // New field for JSON download URL
  processingError: text("processing_error"),
  metadata: jsonb("metadata"), // Additional processing metadata
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// Create Zod schemas
export const insertCarrierSchema = createInsertSchema(carriers).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const updateDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
}).partial();

export type InsertCarrier = z.infer<typeof insertCarrierSchema>;
export type Carrier = typeof carriers.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// CSV data structure for preview
export const csvDataSchema = z.object({
  documentId: z.number(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  totalRows: z.number(),
});

export type CSVData = z.infer<typeof csvDataSchema>;

// Webhook payload schema for document processing results from AWS Lambda
export const webhookDocumentProcessedSchema = z.object({
  s3Key: z.string().min(1, "s3Key is required"),
  textractJobId: z.string().min(1, "textractJobId is required"),
  status: z.enum(["processed", "failed"], {
    errorMap: () => ({ message: "status must be either 'processed' or 'failed'" })
  }),
  // Required fields for successful processing
  jsonS3Key: z.string().optional(),
  jsonUrl: z.string().url().optional(),
  // Optional fields for successful processing
  csvS3Key: z.string().optional(),
  csvUrl: z.string().url().optional(),
  // Optional error field for failed processing
  errorMessage: z.string().optional(),
  // Additional metadata
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => {
    // If status is "processed", require JSON output files (CSV is optional)
    if (data.status === "processed") {
      return data.jsonS3Key && data.jsonUrl;
    }
    // If status is "failed", require error message
    if (data.status === "failed") {
      return data.errorMessage;
    }
    return true;
  },
  {
    message: "For 'processed' status, jsonS3Key and jsonUrl are required. For 'failed' status, errorMessage is required.",
  }
);

export type WebhookDocumentProcessed = z.infer<typeof webhookDocumentProcessedSchema>;

// PDF Parser webhook schema (from Railway service)
export const pdfParserWebhookSchema = z.object({
  status: z.enum(["success", "error"]),
  csv_url: z.string().url().optional(),
  original_filename: z.string().min(1),
  message: z.string().optional(),
});

export type PDFParserWebhook = z.infer<typeof pdfParserWebhookSchema>;
