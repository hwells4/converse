import { S3Client, PutObjectCommand, GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

// AWS Configuration from environment variables
const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
};

const s3Client = new S3Client(awsConfig);
const lambdaClient = new LambdaClient(awsConfig);

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "converseinsurance";
const TEXTRACT_LAMBDA_FUNCTION = process.env.AWS_TEXTRACT_LAMBDA_FUNCTION || "StartTextractPDFAnalysis";

export interface GeneratePresignedUrlParams {
  carrierId: number;
  filename: string;
  documentType: "commission" | "renewal";
  contentType: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  s3Key: string;
  s3Url: string;
}

export interface LambdaInvocationParams {
  s3Key: string;
  documentType: string;
  carrierId: number;
}

export class BackendAWSService {
  /**
   * Generate a presigned URL for direct S3 upload from the frontend
   */
  static async generatePresignedUrl({ 
    carrierId, 
    filename, 
    documentType, 
    contentType 
  }: GeneratePresignedUrlParams): Promise<PresignedUrlResult> {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials not configured");
    }

    // Create a human-readable filename with date, carrier, type, and original name
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Extra robust sanitization - remove ALL non-alphanumeric characters except hyphens and dots
    // This converts any spaces, special chars, etc. to underscores
    const sanitizedFilename = filename
      .toLowerCase()                           // Convert to lowercase
      .replace(/\s+/g, '_')                   // Replace any whitespace with underscores
      .replace(/[^a-z0-9._-]/g, '_')          // Replace any non-alphanumeric (except ._-) with underscores
      .replace(/_+/g, '_')                    // Replace multiple consecutive underscores with single underscore
      .replace(/^_|_$/g, '');                 // Remove leading/trailing underscores
    
    const timestamp = Date.now();
    
    // Simple flat structure: uploads/YYYY-MM-DD_carrier-X_type_originalname_timestamp.pdf
    // Double-check: ensure the final S3 key has NO spaces anywhere
    const s3Key = `uploads/${today}_carrier-${carrierId}_${documentType}_${sanitizedFilename}_${timestamp}.pdf`
      .replace(/\s+/g, '_');  // Final safety check - replace any remaining spaces

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: contentType,
        Metadata: {
          documentType,
          carrierId: carrierId.toString(),
          originalName: filename,
          uploadTimestamp: Date.now().toString(),
        },
      });

      // Generate presigned URL that expires in 15 minutes
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      const s3Url = `https://${BUCKET_NAME}.s3.${awsConfig.region}.amazonaws.com/${s3Key}`;

      return { uploadUrl, s3Key, s3Url };
    } catch (error) {
      console.error("Failed to generate presigned URL:", error);
      throw new Error("Failed to generate upload URL");
    }
  }

  /**
   * Invoke AWS Lambda function for Textract processing
   */
  static async invokeLambda({ s3Key, documentType, carrierId }: LambdaInvocationParams): Promise<string> {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials not configured");
    }

    try {
      const payload = {
        bucket: BUCKET_NAME,
        key: s3Key,
        documentType,
        carrierId,
        // JobTag should be the original PDF's S3 key for tracking
        jobTag: s3Key,
      };

      const command = new InvokeCommand({
        FunctionName: TEXTRACT_LAMBDA_FUNCTION,
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);
      
      if (!response.Payload) {
        throw new Error("Empty response from Lambda");
      }

      const result = JSON.parse(new TextDecoder().decode(response.Payload));

      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      return result.jobId || result.textractJobId || "unknown";
    } catch (error) {
      console.error("Lambda invocation failed:", error);
      throw new Error(`Failed to start document processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download processed data from S3 (CSV or JSON)
   */
  static async downloadFromS3(s3Key: string): Promise<string> {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials not configured");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const response: GetObjectCommandOutput = await s3Client.send(command);
      
      if (!response.Body) {
        throw new Error("Empty file content");
      }

      const content = await response.Body.transformToString();
      return content;
    } catch (error) {
      console.error("Failed to download from S3:", error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned URL for downloading files from S3
   */
  static async generateDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials not configured");
    }

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return downloadUrl;
    } catch (error) {
      console.error("Failed to generate download URL:", error);
      throw new Error("Failed to generate download URL");
    }
  }

  /**
   * Check if AWS credentials are properly configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID && 
      process.env.AWS_SECRET_ACCESS_KEY && 
      process.env.AWS_REGION
    );
  }
} 