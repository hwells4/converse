---
description: 
globs: shared/schema.ts
alwaysApply: false
---
## S1: Centralized Schemas & Types

### S1.1 (Single Source of Truth)
- This file (`shared/schema.ts`) IS THE SINGLE SOURCE OF TRUTH for:
    - Database table definitions (using Drizzle ORM).
    - Zod schemas for API request/response validation and generating TypeScript types.
- All data structures exchanged between client and server, or stored in the database, MUST be defined or derived from schemas in this file.

### S1.2 (New Data Structures)
- Any new data entity (e.g., `carriers`, `header_mappings`) or significant API payload/response structure MUST be defined here first using Drizzle (for DB tables) and/or Zod (for validation/types).

### S1.3 (Schema Updates)
- The `documents` table schema needs to be updated to include:
    - `carrierId` (foreign key to a new `carriers` table).
    - `jsonS3Key` and `jsonS3Url` (for the JSON output from Textract).
    - `status` enum should include: `review_pending`, `review_in_progress`, `salesforce_upload_pending`, `salesforce_upload_failed`.
- Define a new Drizzle table schema for `carriers` (e.g., `id`, `name`).
- (Future) Define a Drizzle table schema for `header_mappings` (e.g., `id`, `carrierId`, `originalHeader`, `standardSalesforceHeader`).

### S1.4 (Zod Schemas)
- Ensure Zod schemas (`insertDocumentSchema`, `updateDocumentSchema`, etc.) are updated to reflect any changes to the Drizzle table schemas.
- Create new Zod schemas for API payloads (e.g., payload for N8N webhook, carrier creation).