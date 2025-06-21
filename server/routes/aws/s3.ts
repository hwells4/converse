import { Router } from "express";
import { z } from "zod";
import { BackendAWSService } from "../../aws-service";
import { storage } from "../../storage";
import { presignedUrlSchema, s3DownloadUrlSchema, s3UploadProcessedCsvSchema } from "../../schemas/request-schemas";

const router = Router();

// AWS S3 presigned URL generation
router.post("/s3/presigned-upload-url", async (req, res) => {
  console.log('🔵 Received presigned URL request');
  console.log('🔵 Request body:', req.body);
  console.log('🔵 Request headers:', req.headers);
  
  try {
    const { carrierId, filename, documentType, contentType } = presignedUrlSchema.parse(req.body);
    console.log('✅ Request validation passed:', { carrierId, filename, documentType, contentType });
    
    if (!BackendAWSService.isConfigured()) {
      console.error('❌ AWS credentials not configured');
      return res.status(500).json({ message: "AWS credentials not configured" });
    }
    console.log('✅ AWS credentials are configured');

    console.log('🔄 Generating presigned URL...');
    const result = await BackendAWSService.generatePresignedUrl({
      carrierId,
      filename,
      documentType,
      contentType,
    });
    console.log('✅ Presigned URL generated successfully:', {
      s3Key: result.s3Key,
      uploadUrlLength: result.uploadUrl?.length,
      s3Url: result.s3Url
    });

    res.json(result);
  } catch (error) {
    console.error('💥 Presigned URL generation error:', error);
    console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof z.ZodError) {
      console.error('❌ Validation errors:', error.errors);
      return res.status(400).json({ message: "Invalid request data", errors: error.errors });
    }
    console.error("Presigned URL generation error:", error);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

// Generate download URL for files (presigned URL)
router.post("/s3/download-url", async (req, res) => {
  try {
    const { s3Key } = s3DownloadUrlSchema.parse(req.body);
    
    if (!BackendAWSService.isConfigured()) {
      return res.status(500).json({ message: "AWS credentials not configured" });
    }

    const downloadUrl = await BackendAWSService.generateDownloadUrl(s3Key);
    res.json({ downloadUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request data", errors: error.errors });
    }
    console.error("Download URL generation error:", error);
    res.status(500).json({ message: "Failed to generate download URL" });
  }
});

// Upload processed CSV to S3 for N8N consumption
router.post("/s3/upload-processed-csv", async (req, res) => {
  try {
    const { csvData, fileName, carrierId, documentId } = s3UploadProcessedCsvSchema.parse(req.body);
    
    if (!BackendAWSService.isConfigured()) {
      return res.status(500).json({ 
        success: false, 
        message: "AWS credentials not configured" 
      });
    }

    // Generate S3 key for processed CSV
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const s3Key = `processed-csv/${new Date().toISOString().split('T')[0]}_carrier-${carrierId}_${sanitizedFileName}_${timestamp}.csv`;

    // Convert array data back to CSV format with headers
    let csvContent = '';
    
    if (csvData.length > 0) {
      // Extract headers from the first row (excluding internal fields like _originalIndex)
      const headers = Object.keys(csvData[0]).filter(key => !key.startsWith('_'));
      const headerRow = headers.map(header => 
        typeof header === 'string' && header.includes(',') ? `"${header}"` : header
      ).join(',');
      
      // Create data rows
      const dataRows = csvData.map((row: any) => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      );
      
      csvContent = [headerRow, ...dataRows].join('\n');
    }

    // Upload to S3
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: csvContent,
      ContentType: 'text/csv',
    });

    await s3Client.send(uploadCommand);

    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    console.log(`✅ Processed CSV uploaded to S3: ${s3Key}`);

    res.json({
      success: true,
      message: "CSV uploaded to S3 successfully",
      csvS3Key: s3Key,
      csvUrl: s3Url
    });

  } catch (error) {
    console.error('💥 CSV S3 upload error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to upload CSV to S3",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export const s3Routes = router;