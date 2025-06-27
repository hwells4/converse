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

### Invitation Management
```bash
npm run create-invitation                    # Create invitation token (any email)
npm run create-invitation -- --email user@example.com    # Create email-specific invitation
npm run create-invitation -- --email user@example.com --days 7    # Custom expiry
npm run create-invitation -- --email user@example.com --no-email   # Skip email sending
npm run list-invitations                    # List all invitation tokens
npm run list-invitations -- --unused-only   # List only unused tokens
```

### Development Workflow
- Always run `npm run check` before commits to ensure TypeScript compliance
- Use `npm run db:push` after schema changes in `shared/schema.ts`
- Test API endpoints via `/api/debug/*` routes during development

## Architecture Overview

This is a full-stack TypeScript application for processing insurance commission statements and renewal reports, now branded as **Converse AI Hub** with complete custom authentication system.

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript, running on Node.js
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **Database**: PostgreSQL with Drizzle ORM (includes users/sessions tables)
- **Storage**: AWS S3 for document storage
- **External Services**: Railway service for PDF processing, Doctly.ai for document parsing, N8N for Salesforce integration

### Project Structure
- `/client` - React frontend application
  - `/src/components` - UI components (mostly shadcn/ui)
    - `profile-menu.tsx` - Dropdown profile menu with user info and logout
  - `/src/hooks` - Custom React hooks (upload, documents, carriers, auth)
  - `/src/lib` - Utilities and service layers (AWS service, query client, auth utilities)
  - `/src/pages` - Page components (home, documents, sign-in, sign-up, forgot-password, reset-password)
- `/server` - Express backend
  - `index.ts` - Server entry point with middleware setup
  - `routes.ts` - Backward compatibility barrel export for routes
  - `db.ts` - Database connection
  - `storage.ts` - Data access layer
  - `aws-service.ts` - AWS S3 operations
  - `/routes` - Modular route definitions
    - `index.ts` - Main route registration
    - `auth.ts` - Authentication endpoints (login, register, logout, password reset)
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
    - `email-service.ts` - Email service for password resets and invitation emails
  - `/middleware` - Express middleware
    - `auth.ts` - Authentication middleware and route protection
  - `/types` - TypeScript type definitions
    - `session.ts` - Session type extensions for express-session
- `/shared` - Shared types and schemas
  - `schema.ts` - Drizzle schema and Zod validation schemas
- `/scripts` - Utility scripts
  - `create-invitation.ts` - Create invitation tokens with email sending
  - `list-invitations.ts` - List and manage invitation tokens
  - `create-demo-user.ts` - Create demo user account
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

3. **Invitation-Only Registration Flow**:
   - Admin creates invitation token via script or API
   - Invitation email automatically sent to recipient (if email provided)
   - User receives professional invitation email with direct signup link
   - User clicks link or enters token manually on signup page
   - System validates token (not used, not expired, email match if required)
   - User completes registration and token is marked as used

### API Endpoints

#### Authentication (`/server/routes/auth.ts`) **[NEW]**
- `POST /api/auth/register` - User registration with invitation token validation
- `POST /api/auth/login` - User login with session creation
- `POST /api/auth/logout` - User logout and session destruction
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

#### Invitation Management (`/server/routes/auth.ts`) **[NEW]**
- `POST /api/auth/create-invitation` - Create invitation tokens with optional email sending
- `POST /api/auth/validate-invitation` - Validate invitation token before signup
- `POST /api/auth/send-invitation` - Send invitation email for existing token
- `GET /api/auth/invitations` - List all invitation tokens with status

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
- `SESSION_SECRET` - Secret key for session signing (change in production)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email service configuration for password resets and invitations
- `SMTP_SECURE` - Whether to use secure SMTP connection (true/false)
- `FROM_NAME` - Display name for outgoing emails (defaults to "Converse AI Hub")
- `CLIENT_URL` - Frontend URL for password reset and invitation links (defaults to http://localhost:5000)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_S3_BUCKET` - S3 bucket name
- `PDF_PARSER_WEBHOOK_URL` - Railway service webhook URL
- `EXPECTED_LAMBDA_WEBHOOK_SECRET` - Webhook security secret
- `N8N_WEBHOOK_URL` - N8N integration webhook URL

### Database Schema
Main tables:
- `users` - User accounts with bcrypt password hashing, email, and reset tokens
- `sessions` - PostgreSQL-backed session storage for authentication
- `invitation_tokens` - Invitation tokens with expiry, usage tracking, and email binding
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
- **Authentication**: All protected API endpoints require valid session authentication
- **Password Security**: Passwords are hashed with bcrypt (12 rounds) and never stored in plaintext
- **Session Security**: Sessions use secure cookies with httpOnly, sameSite, and secure flags in production
- **Rate Limiting**: Auth endpoints have rate limiting (5 attempts per 15 minutes, 3 password resets per hour)
- **Invitation-Only Registration**: Public signup disabled, requires valid invitation tokens

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

## Authentication System

### Implementation Details
The application now uses a complete custom authentication system replacing any previous Clerk integration:

#### Backend Authentication
- **Session-based authentication** using `express-session` with PostgreSQL storage
- **Password hashing** with bcrypt (12 rounds)
- **Email-based password reset** with secure tokens (1-hour expiry)
- **Rate limiting** on authentication endpoints
- **Middleware protection** for all sensitive API routes

#### Frontend Authentication
- **Custom auth pages**: Sign-in, Sign-up, Forgot Password, Reset Password
- **Auth state management** using React Query
- **Automatic redirects** for protected routes
- **Session persistence** across browser sessions
- **User profile display** with logout functionality

#### Demo Account
A demo account has been created for testing:
- **Username**: `demo`
- **Email**: `demo@converseai.com`
- **Password**: `ConverseDemo2024!`

#### Protected Routes
The following API endpoints require authentication:
- Document management (POST, PATCH, DELETE operations)
- Carrier management (POST, PATCH, DELETE operations) 
- S3 operations (all POST requests)
- Processing triggers (PDF parser, Lambda invocations)
- N8N integrations
- Document resubmission

#### Authentication Workflow
1. **Invitation**: Admin creates invitation tokens and sends professional invitation emails
2. **Registration**: Users create accounts with username, email, password, and valid invitation token
3. **Login**: Session-based authentication with secure cookies (2-week rolling expiry)
4. **Password Reset**: Email-based reset flow with secure tokens
5. **Route Protection**: Automatic redirect to sign-in for unauthenticated requests
6. **Session Management**: Rolling sessions that extend on activity

## Invitation-Only Registration System

### Overview
The application implements a complete invitation-only signup system to control user access. Public registration is disabled and all new users must have a valid invitation token.

### Invitation Token Features
- **Unique tokens**: Cryptographically secure 64-character hex tokens
- **Email binding**: Tokens can be tied to specific email addresses
- **Expiry control**: Configurable expiry (default 30 days)
- **Single-use**: Tokens automatically marked as used after successful registration
- **Audit trail**: Tracks who created tokens, when used, and by whom

### Email Integration
- **Professional email templates**: HTML and text versions with Converse AI Hub branding
- **Direct signup links**: Email includes pre-filled signup URL with token
- **Platform features showcase**: Email highlights AI-powered document processing capabilities
- **Automatic sending**: Emails sent automatically when invitation created with email address
- **Graceful fallback**: Shows token in console if email configuration missing

### Admin Management Tools

#### Command Line Scripts
```bash
# Create general invitation (any email can use)
npm run create-invitation

# Create email-specific invitation with auto-email
npm run create-invitation -- --email user@example.com

# Create invitation with custom expiry
npm run create-invitation -- --email user@example.com --days 7

# Create invitation without sending email
npm run create-invitation -- --email user@example.com --no-email

# List all invitations with status
npm run list-invitations

# List only unused invitations
npm run list-invitations -- --unused-only
```

#### API Endpoints
```bash
# Create invitation with email sending
POST /api/auth/create-invitation
{
  "email": "user@example.com",
  "sendEmail": true  # optional, defaults to true
}

# Validate invitation before signup
POST /api/auth/validate-invitation
{
  "token": "invitation-token-here"
}

# Send email for existing invitation
POST /api/auth/send-invitation
{
  "email": "user@example.com",
  "invitationToken": "existing-token"
}

# List all invitations (admin only)
GET /api/auth/invitations
```

### User Experience
1. **Admin creates invitation** via script or API
2. **Professional email sent** with branded template and direct signup link
3. **User clicks email link** and taken to signup page with token pre-filled
4. **User completes registration** with username, email, password, and token
5. **Token validated** against database (not used, not expired, email match)
6. **Account created** and user immediately logged in
7. **Token marked as used** to prevent reuse

### Security Features
- **Token validation**: Checks expiry, usage status, and email binding
- **Rate limiting**: Prevents invitation spam
- **Audit logging**: Full trail of invitation creation and usage
- **Email verification**: Optional email binding ensures invitations reach intended recipients

## UI Improvements

### Profile Dropdown Menu
- **Replaced inline profile display** with clean dropdown menu
- **User avatar icon** that opens dropdown on click
- **Professional layout** showing username, email, and logout option
- **Consistent across pages** (home and documents)
- **Better space utilization** in header area

### Auto-Dismissing Toasts
- **Login success toasts** automatically disappear after 5 seconds
- **Consistent toast behavior** across all authentication actions
- **User-friendly notifications** for all auth state changes

### Branding Updates
Application has been rebranded as **Converse AI Hub**:
- All page headers and titles updated
- Email templates use "Converse AI Hub" branding
- Welcome messages emphasize "AI-powered" processing
- Consistent branding across all authentication pages