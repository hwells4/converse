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
  - `routes.ts` - API route definitions
  - `db.ts` - Database connection
  - `storage.ts` - Data access layer
  - `aws-service.ts` - AWS S3 operations
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

- **Carriers**: `/api/carriers` (GET, POST)
- **Documents**: `/api/documents` (GET), `/api/documents/:id` (GET, PATCH)
- **Upload**: `/api/upload/presigned-url` (POST), `/api/upload/complete` (POST)
- **Processing**: `/api/process/pdf-parser` (POST), `/api/process/doctly-json` (POST)
- **CSV Operations**: `/api/csv/preview/:id` (GET), `/api/csv/upload` (POST)
- **Webhooks**: `/api/pdf-parse-webhook` (POST), `/api/webhook/n8n/completion` (POST)

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