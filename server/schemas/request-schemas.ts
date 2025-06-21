import { z } from "zod";

// Presigned URL generation schema
export const presignedUrlSchema = z.object({
  carrierId: z.number().positive(),
  filename: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  contentType: z.string().min(1),
});

// Lambda invocation schema
export const lambdaInvocationSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  carrierId: z.number().positive(),
});

// PDF Parser trigger schema
export const pdfParserTriggerSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  carrierId: z.number().positive(),
  documentId: z.number().positive(),
});

// S3 download URL schema
export const s3DownloadUrlSchema = z.object({
  s3Key: z.string().min(1)
});

// S3 upload processed CSV schema
export const s3UploadProcessedCsvSchema = z.object({
  csvData: z.array(z.record(z.any())),
  fileName: z.string().min(1),
  carrierId: z.number().positive(),
  documentId: z.number().positive().optional(),
});

// Resubmit failed transactions schema
export const resubmitFailedTransactionsSchema = z.object({
  correctedTransactions: z.array(z.object({
    commissionStatementId: z.string().optional(),
    policyNumber: z.string(),
    insuredName: z.string().optional(),
    transactionAmount: z.union([z.string(), z.number()]),
    originalData: z.record(z.any()),
  })),
});

// N8N status callback schema
export const n8nStatusCallbackSchema = z.object({
  documentId: z.number().positive(),
  status: z.enum(["success", "error", "failed"]),
  message: z.string().optional(),
});

// Webhook simulation schema
export const webhookSimulationSchema = z.object({
  s3Key: z.string().min(1),
  simulateStatus: z.enum(["processed", "failed"]).optional().default("processed"),
});