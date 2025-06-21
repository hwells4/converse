import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Lightweight endpoint for status polling
router.get("/status-check", async (req, res) => {
  try {
    const documents = await storage.getDocuments();
    // Return only essential fields for status checking
    const statusData = documents.map(doc => ({
      id: doc.id,
      status: doc.status,
      updatedAt: doc.processedAt || doc.uploadedAt,
      // Include completion data if it exists
      completionStatus: doc.metadata && typeof doc.metadata === 'object' && 'completionData' in doc.metadata
        ? (doc.metadata as any).completionData?.message
        : null
    }));
    
    // Add cache-busting headers
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    res.json(statusData);
  } catch (error) {
    console.error("Failed to fetch document statuses:", error);
    res.status(500).json({ message: "Failed to fetch document statuses" });
  }
});

export const documentStatusRoutes = router;