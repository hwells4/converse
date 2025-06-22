# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server (both frontend and backend on port 5000)
npm run build        # Build for production (Vite frontend + ESBuild backend)
npm run start        # Start production server
npm run check        # Run TypeScript type checking
npm run db:push      # Push database schema changes via Drizzle
```

### Development Workflow
- Always run `npm run check` before commits to ensure TypeScript compliance
- Use `npm run db:push` after schema changes in `shared/schema.ts`
- Test API endpoints via `/api/debug/*` routes during development

## Architecture Overview

This is a full-stack TypeScript application for processing insurance commission statements and renewal reports.

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript, running on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: AWS S3 for document storage
- **External Services**: Railway service for PDF processing, Doctly.ai for document parsing, N8N for Salesforce integration

### Project Structure
- `/client` - React frontend application
  - `/src/components` - UI components (mostly shadcn/ui)
  - `/src/hooks` - Custom React hooks (upload, documents, carriers)
  - `/src/lib` - Utilities and service layers (AWS service, query client)
  - `/src/pages` - Page components (home, documents)
- `/server` - Express backend
  - `index.ts` - Server entry point with middleware setup
  - `routes.ts` - Backward compatibility barrel export for routes
  - `db.ts` - Database connection
  - `storage.ts` - Data access layer
  - `aws-service.ts` - AWS S3 operations
  - `/routes` - Modular route definitions
    - `index.ts` - Main route registration
    - `carriers.ts` - Carrier management endpoints
    - `documents.ts` - Document CRUD operations
    - `/aws` - AWS service routes
      - `s3.ts` - S3 presigned URLs and operations
      - `lambda.ts` - Lambda invocation and AWS testing
    - `/processing` - Document processing routes
      - `pdf.ts` - PDF parser integration
      - `csv.ts` - CSV data operations
    - `/webhooks` - Webhook handlers
      - `pdf-parser.ts` - PDF parser service webhooks
      - `document.ts` - Document processing webhooks
      - `n8n.ts` - N8N completion webhooks
      - `corrections.ts` - N8N correction webhooks
    - `/integrations` - External service integrations
      - `n8n.ts` - N8N Salesforce upload endpoints
    - `/debug` - Development and testing routes
      - `test.ts` - Test endpoints and webhook simulation
  - `/schemas` - Request validation schemas
    - `request-schemas.ts` - Zod schemas for API requests
  - `/utils` - Utility functions
    - `webhook-security.ts` - Webhook authentication helpers
    - `csv-parser.ts` - CSV parsing utilities
- `/shared` - Shared types and schemas
  - `schema.ts` - Drizzle schema and Zod validation schemas
- `/migrations` - Database migrations

### Key Workflows

1. **Document Upload Flow**:
   - User uploads PDF → Frontend gets presigned URL → Direct upload to S3
   - Document record created with status "uploaded"
   - Triggers either standard PDF parser or Doctly JSON parser
   - External Railway service downloads PDF, processes via Doctly, saves results to S3
   - Webhook updates document status to "processed" or "failed"

2. **CSV Processing Flow**:
   - User reviews processed CSV data
   - Maps CSV columns to required fields
   - Confirms commission statement details
   - Triggers N8N webhook for Salesforce upload
   - N8N completion webhook updates document status to "completed"

### API Endpoints

#### Carrier Management (`/server/routes/carriers.ts`)
- `GET /api/carriers` - List all carriers
- `GET /api/carriers/:id` - Get single carrier
- `POST /api/carriers` - Create new carrier

#### Document Management (`/server/routes/documents.ts`)
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get single document
- `POST /api/documents` - Create document record
- `PATCH /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/status/:status` - Get documents by status

#### AWS Operations
- **S3** (`/server/routes/aws/s3.ts`)
  - `POST /api/s3/presigned-upload-url` - Generate presigned upload URL
  - `POST /api/s3/download-url` - Generate download URL
  - `POST /api/s3/upload-processed-csv` - Upload processed CSV
- **Lambda** (`/server/routes/aws/lambda.ts`)
  - `POST /api/lambda/invoke-textract` - Invoke Textract processing
  - `GET /api/test/aws-credentials` - Test AWS configuration

#### Document Processing
- **PDF** (`/server/routes/processing/pdf.ts`)
  - `POST /api/pdf-parser/trigger` - Trigger PDF parsing
  - `GET /api/documents/:id/processed-json` - Get processed JSON
  - `GET /api/documents/:id/processed-csv` - Download processed CSV
- **CSV** (`/server/routes/processing/csv.ts`)
  - `GET /api/documents/:id/csv-data` - Get CSV data
  - `GET /api/csv/preview/:id` - Preview CSV (alias)

#### Webhooks
- **PDF Parser** (`/server/routes/webhooks/pdf-parser.ts`)
  - `POST /api/pdf-parse-webhook` - Railway PDF parser callback
  - `POST /api/test-webhook` - Test webhook connectivity
- **Document Processing** (`/server/routes/webhooks/document.ts`)
  - `POST /api/webhook/document-processed` - AWS Lambda callback
- **N8N Unified** (`/server/routes/webhooks/n8n-unified.ts`) **[ACTIVE]**
  - `POST /api/webhook/n8n-completion` - N8N completion callback with standardized handling
  - `POST /api/webhook/n8n-correction-completion` - N8N correction completion callback
- **Legacy N8N** (`/server/routes/webhooks/n8n.ts`) **[DISABLED]**
  - Replaced by unified webhook system

#### N8N Integration (`/server/routes/integrations/n8n.ts`)
- `POST /api/n8n/salesforce-upload` - Trigger Salesforce upload
- `POST /api/n8n/salesforce-status` - Status callback from N8N
- `POST /api/documents/:id/resubmit-failed-transactions` - Resubmit corrections

#### Debug/Test (`/server/routes/debug/test.ts`)
- `POST /api/test/webhook-simulation` - Simulate webhook calls
- `ALL /api/webhook/*` - Debug webhook logger

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_S3_BUCKET` - S3 bucket name
- `PDF_PARSER_WEBHOOK_URL` - Railway service webhook URL
- `EXPECTED_LAMBDA_WEBHOOK_SECRET` - Webhook security secret
- `N8N_WEBHOOK_URL` - N8N integration webhook URL

### Database Schema
Main tables:
- `carriers` - Insurance carriers with Salesforce IDs
- `documents` - Uploaded documents with processing status tracking

Document statuses: uploaded → processing → processed → salesforce_upload_pending → uploading → completed (or failed at any stage)

### Error Handling
- Client errors handled with consistent HTTP status codes and error messages
- Global error middleware in server/index.ts
- Client-side error handling with toast notifications
- Detailed logging for webhook requests and processing errors

### Route Architecture Notes
- Routes are modularized by functionality for better maintainability
- Each route module uses Express Router for isolated routing
- The main `routes.ts` file provides backward compatibility by re-exporting from modular files
- Request validation schemas are centralized in `/server/schemas/request-schemas.ts`
- Utility functions (CSV parsing, webhook security) are extracted to `/server/utils`
- This structure allows for:
  - Easier debugging and testing of specific functionality
  - Reduced merge conflicts when multiple developers work on different features
  - Better code organization and separation of concerns
  - Gradual migration from legacy code patterns

## Development Guidelines

### Security Requirements
- **CRITICAL**: AWS credentials MUST NEVER be exposed in client-side code or `VITE_` prefixed environment variables
- All AWS operations (S3, Lambda) MUST be executed server-side only
- Use presigned URLs for client-side S3 uploads
- Validate all webhook requests with security tokens where possible

### Code Organization Principles
- **Database Schema**: All schema changes MUST be made in `shared/schema.ts` first using Drizzle + Zod
- **API Validation**: All API endpoints MUST validate inputs using Zod schemas from `shared/schema.ts`
- **UI Components**: Prioritize shadcn/ui components for consistency (`@/components/ui`)
- **State Management**: Use TanStack Query for server state, React hooks for local UI state
- **Error Handling**: Use toast notifications via `use-toast.ts` for user feedback

### File Storage Architecture
- **S3 Storage**: All user files (PDFs) and processed outputs (CSV/JSON) stored in AWS S3
- **Database**: PostgreSQL stores only metadata and references (S3 keys/URLs), never binary data
- **S3 Key Convention**: `uploads/<carrier_id>/<uuid>/<filename>` for uploads, `processed/<carrier_id>/<uuid>/` for outputs

### Webhook System Architecture
- **Standardized Handler**: All webhooks use `/server/utils/webhook-handler.ts` for consistent logging, validation, and error handling
- **N8N Unified Webhooks**: Current system uses `n8n-unified.ts` with standardized payload handling and correction logic
- **Webhook Response Format**: All webhooks return standardized `WebhookResponse` interface with `success`, `message`, `data`, and `error` fields
- **Payload Validation**: Webhooks validate incoming payloads using Zod schemas with detailed error reporting
- **Correction Processing**: Advanced logic to handle N8N correction callbacks with transaction count reconciliation