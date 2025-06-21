import { Router } from "express";
import { storage } from "../../storage";
import { BackendAWSService } from "../../aws-service";
import { parseCSVContent } from "../../utils/csv-parser";

const router = Router();

// Get CSV data (either processed from PDF or directly uploaded CSV)
router.get("/documents/:id/csv-data", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`🔵 Fetching CSV data for document ID: ${id}`);
    
    const document = await storage.getDocument(id);
    console.log(`📄 Document found:`, {
      id: document?.id,
      filename: document?.filename,
      status: document?.status,
      csvS3Key: document?.csvS3Key,
      s3Key: document?.s3Key
    });
    
    if (!document) {
      console.log(`❌ Document ${id} not found`);
      return res.status(404).json({ message: "Document not found" });
    }

    if (!BackendAWSService.isConfigured()) {
      console.log(`❌ AWS credentials not configured`);
      return res.status(500).json({ message: "AWS credentials not configured" });
    }

    let csvContent: string;

    // Check if this is a processed PDF (has csvS3Key) or direct CSV upload
    if (document.csvS3Key) {
      console.log(`☁️ Downloading processed CSV from S3 key: ${document.csvS3Key}`);
      csvContent = await BackendAWSService.downloadFromS3(document.csvS3Key);
    } else if (document.s3Key && (document.originalName?.endsWith('.csv') || document.filename.includes('.csv'))) {
      console.log(`☁️ Downloading direct CSV upload from S3 key: ${document.s3Key}`);
      csvContent = await BackendAWSService.downloadFromS3(document.s3Key);
    } else {
      console.log(`❌ Document ${id} has no CSV data available`);
      console.log(`📋 Document details: originalName=${document.originalName}, filename=${document.filename}, s3Key=${document.s3Key}`);
      return res.status(404).json({ message: "CSV data not available for this document" });
    }

    console.log(`📥 Downloaded CSV content length: ${csvContent.length} characters`);
    
    // Parse CSV content into JSON
    const parsedData = parseCSVContent(csvContent);
    
    console.log(`✅ CSV parsed successfully. Headers:`, parsedData.headers);
    console.log(`✅ Rows count:`, parsedData.rows.length);

    res.json(parsedData);
  } catch (error) {
    console.error("💥 CSV data fetch error:", error);
    console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ message: "Failed to fetch CSV data" });
  }
});

// Alias for CSV preview (same functionality)
router.get("/csv/preview/:id", async (req, res, next) => {
  // Forward to the main CSV data endpoint
  req.url = `/documents/${req.params.id}/csv-data`;
  next();
});

export const csvProcessingRoutes = router;