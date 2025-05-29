import { documents, carriers, type Document, type InsertDocument, type UpdateDocument, type Carrier, type InsertCarrier } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getDocument(id: number): Promise<Document | undefined>;
  getDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: UpdateDocument): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  getDocumentsByStatus(status: string): Promise<Document[]>;
  getDocumentByS3Key(s3Key: string): Promise<Document | undefined>;
  
  // Carrier methods
  getCarriers(): Promise<Carrier[]>;
  getCarrier(id: number): Promise<Carrier | undefined>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
}

export class DatabaseStorage implements IStorage {
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.uploadedAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values({
        ...insertDocument,
        metadata: insertDocument.metadata || null,
        s3Url: insertDocument.s3Url || null,
        status: insertDocument.status || "uploaded",
        textractJobId: insertDocument.textractJobId || null,
        csvS3Key: insertDocument.csvS3Key || null,
        csvUrl: insertDocument.csvUrl || null,
        processingError: insertDocument.processingError || null,
      })
      .returning();
    return document;
  }

  async updateDocument(id: number, updates: UpdateDocument): Promise<Document | undefined> {
    const updateData: any = { ...updates };
    
    // Set processedAt when status changes to "processed"
    if (updates.status === "processed") {
      updateData.processedAt = new Date();
    }

    const [document] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();
    
    return document || undefined;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning();
    return result.length > 0;
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.status, status));
  }

  async getDocumentByS3Key(s3Key: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.s3Key, s3Key));
    return document || undefined;
  }

  // Carrier methods implementation
  async getCarriers(): Promise<Carrier[]> {
    return await db.select().from(carriers).orderBy(carriers.name);
  }

  async getCarrier(id: number): Promise<Carrier | undefined> {
    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, id));
    return carrier || undefined;
  }

  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    const [carrier] = await db
      .insert(carriers)
      .values(insertCarrier)
      .returning();
    return carrier;
  }
}

export const storage = new DatabaseStorage();