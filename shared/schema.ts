import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invitation tokens table for invitation-only registration
export const invitationTokens = pgTable("invitation_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email"), // Optional: can be tied to specific email
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: integer("used_by").references(() => users.id),
  expiresAt: timestamp("expires_at"), // Optional: tokens can expire
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
});

// Sessions table is managed by connect-pg-simple, not Drizzle
// This table will be automatically created by connect-pg-simple with the correct schema:
// - sid (varchar): session ID
// - sess (json): session data  
// - expire (timestamp): expiration time
// export const sessions = pgTable("sessions", {
//   id: text("id").primaryKey(), // session ID
//   userId: integer("user_id").references(() => users.id).notNull(),
//   data: jsonb("data").notNull(),
//   expiresAt: timestamp("expires_at").notNull(),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
//   updatedAt: timestamp("updated_at").defaultNow().notNull(),
// });

// Carriers table for managing insurance carriers
export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  salesforceId: text("salesforce_id").notNull().unique(),
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
  status: text("status").notNull().default("uploaded"), // 'uploaded', 'processing', 'processed', 'failed', 'review_pending', 'salesforce_upload_pending', 'uploading', 'completed'
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

// Invitation token schemas
export const insertInvitationTokenSchema = createInsertSchema(invitationTokens, {
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Valid email is required").optional(),
  expiresAt: z.date().optional(),
});

export const validateInvitationTokenSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type InsertInvitationToken = z.infer<typeof insertInvitationTokenSchema>;
export type InvitationToken = typeof invitationTokens.$inferSelect;

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

// Commission statement schema for final confirmation
export const commissionStatementSchema = z.object({
  carrierId: z.number(),
  carrierName: z.string(),
  carrierSalesforceId: z.string(),
  statementAmount: z.number(),
  statementNotes: z.string().optional(),
  statementDate: z.string(), // ISO date string
});

export type CommissionStatement = z.infer<typeof commissionStatementSchema>;

// N8N webhook payload schema for Salesforce upload
export const n8nWebhookPayloadSchema = z.object({
  statement: commissionStatementSchema,
  transactions: z.object({
    csvS3Key: z.string(),
    csvUrl: z.string(),
    headers: z.array(z.string()),
  }), // CSV data uploaded to S3 instead of raw data
  transactionCount: z.number(),
  documentId: z.number(),
  fileName: z.string(),
});

export type N8NWebhookPayload = z.infer<typeof n8nWebhookPayloadSchema>;

// N8N completion webhook schema
export const n8nCompletionWebhookSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  document: z.object({
    id: z.number(),
    filename: z.string(),
    originalName: z.string(),
    documentType: z.string(),
    carrierId: z.number(),
    s3Key: z.string(),
    s3Url: z.string(),
    fileSize: z.number(),
    status: z.string(),
    textractJobId: z.string().nullable(),
    csvS3Key: z.string(),
    csvUrl: z.string(),
    jsonS3Key: z.string().nullable(),
    jsonUrl: z.string().nullable(),
    processingError: z.string().nullable(),
    metadata: z.object({
      completionData: z.object({
        message: z.string(),
        carrierName: z.string(),
        completedAt: z.string(),
        totalTransactions: z.number(),
        failedTransactions: z.array(z.any()),
        numberOfSuccessful: z.number(),
      })
    }),
    uploadedAt: z.string(),
    processedAt: z.string(),
  })
});

// Support both single completion and array format from N8N
export const n8nCompletionWebhookArraySchema = z.array(n8nCompletionWebhookSchema);

export type N8NCompletionWebhook = z.infer<typeof n8nCompletionWebhookSchema>;
export type N8NCompletionWebhookArray = z.infer<typeof n8nCompletionWebhookArraySchema>;

// Auth-related schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resetToken: true,
  resetTokenExpires: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one lowercase letter, one uppercase letter, and one number"),
});

// Registration schema with invitation token requirement
export const registerWithInvitationSchema = insertUserSchema.extend({
  invitationToken: z.string().min(1, "Invitation token is required"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one lowercase letter, one uppercase letter, and one number"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterWithInvitation = z.infer<typeof registerWithInvitationSchema>;
export type User = typeof users.$inferSelect;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
// Session type is handled by connect-pg-simple, not Drizzle
// export type Session = typeof sessions.$inferSelect;
