---
description: 
globs: client/src/**/*.tsx,client/src/**/*.ts,client/src/*.tsx,client/index.html,client/src/index.css
alwaysApply: false
---
## I. Storage & AWS Integration

### B1: S3 as Primary Blob Storage
- B1.1 (Data Location): ALL user-uploaded files (PDFs) and Lambda-generated output files (CSVs, JSONs with confidence scores) MUST be stored in AWS S3.
- B1.2 (No Local/DB Blobs): Express server or PostgreSQL database MUST NOT store large binary file contents directly. Store *references* (S3 keys/URLs) ONLY.

### B2: PostgreSQL (Drizzle) for Metadata
- B2.1 (Metadata Repository): PostgreSQL (managed by Drizzle ORM via `server/storage.ts`) IS the authoritative source for ALL metadata related to S3 objects and document processing. This includes:
    - S3 keys/URLs for original PDF, processed CSV, and processed JSON.
    - Status (uploaded, processing, review_pending, salesforce_upload_pending, completed, failed).
    - Textract Job ID, file size, original name, document type, selected carrier ID.
    - Processing errors, upload/processing timestamps.
    - (Future) Header mapping configurations per carrier.
- B2.2 (Implement `server/storage.ts`): The `server/storage.ts` file, specifically the `DrizzleStorage` class (or equivalent), MUST implement the `IStorage` interface using Drizzle queries against the PostgreSQL database. `MemStorage` is a placeholder and must be fully replaced.
- B2.3 (Schema Adherence): All database interactions MUST use the Drizzle schemas defined in `shared/schema.ts`.

### B3: Secure AWS Credentials & Operations (CRITICAL)
- B3.1 (No Client-Side Credentials): AWS credentials (access keys, secret keys) MUST NEVER be present in client-side code (`client/**`) or exposed via `VITE_` prefixed environment variables.
- B3.2 (Backend AWS Operations): ALL AWS SDK operations requiring credentials (S3 actions like GetObject/PutObject, Lambda invocations) MUST be executed by THIS backend server (`server/**`).
- B3.3 (S3 Uploads via Backend Presigned URLs):
    - Implement a backend API endpoint (e.g., `/api/s3/presigned-upload-url`) that generates an S3 presigned URL for PDF uploads.
    - This URL will be requested by the client for direct S3 upload.
    - The S3 key for uploaded PDFs should follow a convention like: `uploads/<carrier_id>/<uuid>/<original_filename>.pdf`.
- B3.4 (Lambda Invocations via Backend):
    - Implement a backend API endpoint (e.g., `/api/lambda/invoke-textract`) to invoke AWS Lambda functions.
    - Client will call this endpoint.

### B4: Lambda Function Integration
- B4.1 (Invocation): Existing Lambdas (e.g., Textract processor) MUST be invoked by THIS backend server (see B3.4).
- B4.2 (Status Updates & Output):
    - Lambdas MUST report completion status (success with CSV/JSON details, or failure with error) by calling the `/api/webhook/document-processed` endpoint on THIS Express server.
    - Lambdas SHOULD output both a CSV and a JSON (with confidence scores, if possible) to an S3 prefix like `processed/<carrier_id>/<uuid>/`.
- B4.3 (Webhook Handler): The `/api/webhook/document-processed` handler in `server/routes.ts` MUST securely validate incoming requests (if possible) and update the corresponding document's metadata in PostgreSQL via `server/storage.ts`.
- B4.4 (New Asynchronous Tasks): New backend processing that is asynchronous or resource-intensive SHOULD be designed as a new AWS Lambda function.

### B5: API Design & Validation
- B5.1 (Input Validation): ALL API endpoints in `server/routes.ts` accepting data (body, params, query) MUST validate this data using Zod schemas from `shared/schema.ts`.
- B5.2 (Output): API responses with S3 URLs MUST provide fully-formed, accessible URLs (public S3 URLs or backend-generated presigned URLs for downloads if objects are private).

### B6: Configuration & Environment Variables
- B6.1 (Server-Side Config): ALL AWS-related configurations (region, S3 bucket name, Lambda function names, IAM roles) MUST be managed via server-side environment variables (Replit Secrets).
- B6.2 (No `VITE_` for Backend): Backend code MUST NOT rely on environment variables prefixed with `VITE_`.

## II. Application Specific Logic
### B7: Salesforce Integration (via N8N)
- B7.1 (N8N Webhook Trigger): Implement a backend API endpoint (e.g., `/api/salesforce/upload-data`) that receives confirmed, standardized data from the client.
- B7.2 (Call N8N): This endpoint will then make an HTTP POST request to the pre-configured N8N webhook URL, sending the data in the format N8N expects.
- B7.3 (N8N Status Callback): Implement a backend API endpoint (e.g., `/api/webhook/salesforce-status`) for N8N to call back with the Salesforce upload status. This updates the document status in the DB.

### B8: Carrier and Header Management
- B8.1 (Carrier Data): Store carrier information (ID, name) in a new `carriers` table (define in `shared/schema.ts`, manage via `server/storage.ts`).
- B8.2 (Standard Headers): The list of "Standard Salesforce Headers" will be defined and potentially stored in the DB or a backend configuration for mapping purposes.
- B8.3 (Header Mapping Logic - Future): Logic for saving and applying carrier-specific header mappings will reside in the backend, interacting with `server/storage.ts`.
