import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertDocumentSchema, updateDocumentSchema } from "@shared/schema";

const router = Router();

// Get all documents
router.get("/documents", async (req, res) => {
  try {
    const documents = await storage.getDocuments();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// Get single document
router.get("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`🔵 Fetching document ID: ${id}`);
    
    const document = await storage.getDocument(id);
    console.log(`📄 Document retrieved:`, {
      id: document?.id,
      filename: document?.filename,
      status: document?.status,
      jsonS3Key: document?.jsonS3Key,
      csvS3Key: document?.csvS3Key,
      textractJobId: document?.textractJobId,
      processedAt: document?.processedAt
    });
    
    if (!document) {
      console.log(`❌ Document ${id} not found`);
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    console.error("💥 Failed to fetch document:", error);
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

// Create new document record
router.post("/documents", async (req, res) => {
  try {
    const documentData = insertDocumentSchema.parse(req.body);
    const document = await storage.createDocument(documentData);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid document data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create document" });
  }
});

// Update document status/metadata
router.patch("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = updateDocumentSchema.parse(req.body);
    
    const document = await storage.updateDocument(id, updates);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid update data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update document" });
  }
});

// Delete document
router.delete("/documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const success = await storage.deleteDocument(id);
    
    if (!success) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.status(204).send(); // No content response for successful deletion
  } catch (error) {
    console.error("Failed to delete document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// Get documents by status
router.get("/documents/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const documents = await storage.getDocumentsByStatus(status);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents by status" });
  }
});

export const documentRoutes = router;