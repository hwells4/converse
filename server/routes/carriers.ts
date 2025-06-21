import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCarrierSchema } from "@shared/schema";

const router = Router();

// Get all carriers
router.get("/carriers", async (req, res) => {
  try {
    const carriers = await storage.getCarriers();
    res.json(carriers);
  } catch (error) {
    console.error("Failed to fetch carriers:", error);
    res.status(500).json({ message: "Failed to fetch carriers" });
  }
});

// Get single carrier by ID
router.get("/carriers/:id", async (req, res) => {
  try {
    const carrierId = parseInt(req.params.id);
    if (isNaN(carrierId)) {
      return res.status(400).json({ message: "Invalid carrier ID" });
    }
    
    const carrier = await storage.getCarrier(carrierId);
    if (!carrier) {
      return res.status(404).json({ message: "Carrier not found" });
    }
    
    res.json(carrier);
  } catch (error) {
    console.error("Failed to fetch carrier:", error);
    res.status(500).json({ message: "Failed to fetch carrier" });
  }
});

// Create new carrier
router.post("/carriers", async (req, res) => {
  try {
    const carrierData = insertCarrierSchema.parse(req.body);
    const carrier = await storage.createCarrier(carrierData);
    res.status(201).json(carrier);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid carrier data", errors: error.errors });
    }
    console.error("Failed to create carrier:", error);
    res.status(500).json({ message: "Failed to create carrier" });
  }
});

export const carrierRoutes = router;