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
      - `n8n-unified.ts` - N8N completion and correction webhooks (**ACTIVE**)
      - `n8n.ts` - Legacy N8N webhooks (**DISABLED**)
      - `corrections.ts` - Legacy correction webhooks (**REPLACED**)
    - `/integrations` - External service integrations
      - `n8n.ts` - N8N Salesforce upload endpoints
    - `/debug` - Development and testing routes
      - `test.ts` - Test endpoints and webhook simulation
  - `/schemas` - Request validation schemas
    - `request-schemas.ts` - Zod schemas for API requests
  - `/utils` - Utility functions
    - `webhook-handler.ts` - Standardized webhook handling framework
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

3. **N8N Integration Flow**:
   - **Initial Upload**: Frontend → `/api/n8n/salesforce-upload` → N8N webhook → Salesforce → N8N callback → `/api/webhook/n8n-completion`
   - **Corrections**: Frontend → `/api/documents/:id/resubmit-failed-transactions` → N8N correction webhook → Salesforce → N8N callback → `/api/webhook/n8n-correction-completion`
   - **Transaction Reconciliation**: Uses "simple math logic" (v2) to track successful/failed transactions

4. **Invitation-Only Registration Flow**:
   - Admin creates invitation token via script or API
   - Invitation email automatically sent to recipient (if email provided)
   - User receives professional invitation email with direct signup link
   - User clicks link or enters token manually on signup page
   - System validates token (not used, not expired, email match if required)
   - User completes registration and token is marked as used

5. **Document Processing Polling System**:
   - PDF uploads trigger background processing and start status polling
   - `useUpload` hook manages polling intervals with proper cleanup
   - Polls `/api/documents/:id/status` every 5 seconds for processing updates
   - **Memory-Safe Design**: All intervals tracked in `useRef<Set<NodeJS.Timeout>>`
   - **Automatic Cleanup**: `useEffect` cleanup clears intervals on component unmount
   - **Multi-Document Support**: Can handle multiple simultaneous uploads/polling
   - **Timeout Protection**: Auto-stops polling after 5 minutes if no status change
   - **Error Resilience**: Individual polling failures don't stop the process
   - Notifies user via toast when processing completes or fails

### API Endpoints

#### Authentication (`/server/routes/auth.ts`)
- `POST /api/auth/register` - User registration with invitation token validation
- `POST /api/auth/login` - User login with session creation
- `POST /api/auth/logout` - User logout and session destruction
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token

#### Invitation Management (`/server/routes/auth.ts`)
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
- **Legacy Webhooks** (Disabled/Replaced)
  - `/server/routes/webhooks/n8n.ts` - Replaced by unified system
  - `/server/routes/webhooks/corrections.ts` - Replaced by unified system

#### N8N Integration (`/server/routes/integrations/n8n.ts`)
- `POST /api/n8n/salesforce-upload` - Trigger Salesforce upload
- `POST /api/n8n/salesforce-status` - Status callback from N8N
- `POST /api/documents/:id/resubmit-failed-transactions` - Resubmit corrections

#### Debug/Test (`/server/routes/debug/test.ts`)
- `POST /api/test/webhook-simulation` - Simulate webhook calls
- `GET /api/test/webhook-endpoints` - List all webhook endpoints
- `POST /api/test/validation-edge-cases` - Test transaction validation edge cases
- `POST /api/test/n8n-completion` - Test N8N completion webhook
- `POST /api/test/n8n-correction` - Test N8N correction webhook
- `ALL /api/webhook/*` - Debug webhook logger

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret key for session signing (change in production)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email service configuration
- `SMTP_SECURE` - Whether to use secure SMTP connection (true/false)
- `FROM_NAME` - Display name for outgoing emails (defaults to "Converse AI Hub")
- `CLIENT_URL` - Frontend URL for password reset and invitation links (defaults to http://localhost:5000)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_S3_BUCKET` - S3 bucket name
- `PDF_PARSER_WEBHOOK_URL` - Railway service webhook URL
- `EXPECTED_LAMBDA_WEBHOOK_SECRET` - Webhook security secret
- `N8N_WEBHOOK_URL` - N8N integration webhook URL (override for production URLs)
- `COMMISSION_CORRECTION_WEBHOOK_URL` - N8N correction webhook URL override
- `WEBHOOK_BASE_URL` - Base URL for webhook callbacks

### Database Schema
Main tables:
- `users` - User accounts with bcrypt password hashing, email, and reset tokens
- `sessions` - PostgreSQL-backed session storage for authentication
- `invitation_tokens` - Invitation tokens with expiry, usage tracking, and email binding
- `carriers` - Insurance carriers with Salesforce IDs
- `documents` - Uploaded documents with processing status tracking

Document statuses: 
- Basic flow: `uploaded` → `processing` → `processed`/`review_pending` → `salesforce_upload_pending` → `uploading` → `completed`
- Error states: `failed` (at any stage)
- Correction flow: `completed_with_errors` → `correction_pending` → `completed`/`completed_with_errors`

### Webhook System Details

#### N8N Production URLs
- Upload: `https://hwells4.app.n8n.cloud/webhook/832afa61-2bcc-433c-8df6-192009696764`
- Correction: `https://hwells4.app.n8n.cloud/webhook/commission-correction`
- Test endpoints available with `/webhook-test/` prefix

#### Webhook Handler Infrastructure
All webhooks use standardized handler (`/server/utils/webhook-handler.ts`):
- Unique webhook IDs for request tracking
- Zod schema validation with detailed errors
- Consistent response format: `{ success, message, data?, error? }`
- Performance tracking (duration logging)
- Comprehensive request/response logging

#### Security Implementation
- **Lambda webhooks**: Validate via `x-webhook-secret` header and User-Agent patterns
- **N8N webhooks**: Currently no authentication (relies on URL obscurity)
- **Recommendation**: Implement webhook signatures for all external services

### Reliability Improvements

#### ✅ Recently Fixed Issues
1. **CSV Parser Robustness** (`/server/utils/csv-parser.ts`): **FIXED**
   - ✅ Handles malformed CSV with unclosed quotes and escaped quotes
   - ✅ Memory protection with size limits (10MB files, 50K lines, 50K chars/line, 1K fields/line)
   - ✅ Error recovery - continues parsing when individual rows fail
   - ✅ Comprehensive error logging and validation
   - ✅ Returns `parseErrors` array for debugging failed rows

2. **Session Cookie Management** (`/server/routes/auth.ts:307`): **FIXED**
   - ✅ Logout now properly clears "sessionId" cookie (matches session config)
   - ✅ Prevents orphaned sessions on logout

3. **Transaction Count Validation** (`/server/routes/webhooks/n8n-unified.ts`): **FIXED**
   - ✅ Added comprehensive validation for transaction counts in both completion and correction flows
   - ✅ Rejects invalid data with clear error messages (`count_mismatch`, `negative_counts`)
   - ✅ Simplified correction reconciliation logic with better validation
   - ✅ Enhanced error logging and debugging information
   - ✅ Prevents silent failures and ensures data integrity

4. **Upload Polling Memory Leak** (`/client/src/hooks/use-upload.ts`): **FIXED**
   - ✅ Polling intervals now properly cleaned up when components unmount
   - ✅ Tracks active intervals using `useRef<Set<NodeJS.Timeout>>` for cleanup
   - ✅ `useEffect` cleanup function clears all intervals on unmount
   - ✅ Fixed React Hook order violation for consistent hook execution
   - ✅ Maintains existing 5-minute timeout and status-based cleanup
   - ✅ Prevents unnecessary API calls and memory leaks

#### Remaining Known Issues

#### Data Integrity Issues
1. **Invitation Token Expiry** (`/server/routes/auth.ts:422-424`):
   - SQL query doesn't properly filter by expiry in WHERE clause

#### Performance Issues
1. **No Database Connection Pooling**: Could exhaust connections under load
2. **Missing Database Indexes**: No indexes on frequently queried fields

#### Error Handling Gaps
1. **Frontend Error Parsing** (`/client/src/lib/aws-service.ts:236-245`): Assumes JSON in error responses
2. **Session Destruction Race Condition** (`/server/middleware/auth.ts:77-80`): Doesn't await completion
3. **No Email Retry Logic**: Failed emails are lost
4. **Missing Error States**: Document page doesn't handle auth loading failures

#### Security Notes
- **CORS Configuration**: Development allows all origins (acceptable for small company deployment)
- **N8N Webhook Authentication**: No signature validation (relies on URL obscurity - acceptable for controlled environment)

### Debugging Tips

#### Webhook Testing
1. Use `/api/test/webhook-simulation` to simulate webhook calls
2. Check `/api/test/webhook-endpoints` for all available webhook URLs
3. All `/api/webhook/*` requests are logged for debugging
4. Look for webhook IDs in logs for request tracking

#### Common Issues
1. **"User not found in session"**: Session expired or user deleted
2. **CSV parsing errors**: 
   - Check server logs for specific row-level errors
   - Look for `parseErrors` array in response for detailed failure info
   - CSV parser now handles most malformed data gracefully
   - Check for files exceeding limits (10MB, 50K rows, 50K chars/line)
3. **N8N webhook failures**: Verify payload format (expects arrays)
4. **Document stuck in status**: Check webhook logs for failed callbacks
5. **Session logout issues**: Fixed - now properly clears sessionId cookie

#### Testing Commands
```bash
# Test webhook connectivity
curl -X POST http://localhost:5000/api/test-webhook

# List all webhook endpoints
curl http://localhost:5000/api/test/webhook-endpoints

# Test transaction validation edge cases
curl -X POST http://localhost:5000/api/test/validation-edge-cases

# Test N8N completion webhook
curl -X POST http://localhost:5000/api/test/n8n-completion \
  -H "Content-Type: application/json" \
  -d '{"documentId": 1, "numberOfSuccessful": 8, "totalTransactions": 10}'

# Simulate N8N completion
curl -X POST http://localhost:5000/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "n8n-completion", "documentId": "123"}'
```

## Development Guidelines

### Security Requirements
- **CRITICAL**: AWS credentials MUST NEVER be exposed in client-side code or `VITE_` prefixed environment variables
- All AWS operations (S3, Lambda) MUST be executed server-side only
- Use presigned URLs for client-side S3 uploads
- Implement webhook signatures for all external service callbacks
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
- **Webhook Processing**: Use standardized webhook handler for all external callbacks

### File Storage Architecture
- **S3 Storage**: All user files (PDFs) and processed outputs (CSV/JSON) stored in AWS S3
- **Database**: PostgreSQL stores only metadata and references (S3 keys/URLs), never binary data
- **S3 Key Convention**: `uploads/<carrier_id>/<uuid>/<filename>` for uploads, `processed/<carrier_id>/<uuid>/` for outputs

### CSV Processing System
The CSV parser (`/server/utils/csv-parser.ts`) has been enhanced for production reliability:

#### **Safety Limits**
- Maximum file size: 10MB
- Maximum rows: 50,000 
- Maximum line length: 50,000 characters
- Maximum fields per row: 1,000

#### **Error Recovery**
- Individual row failures don't stop entire parsing
- Unclosed quotes handled gracefully with warnings
- Escaped quotes (`""`) properly processed
- Column count mismatches logged but parsing continues
- Fails only if >10% of rows have errors

#### **Error Reporting**
- Returns `parseErrors` array with specific row failure details
- Comprehensive logging for debugging
- Row-level error tracking with line numbers
- Memory usage warnings for large files

#### **Usage Example**
```typescript
const result = parseCSVContent(csvContent);
// result = {
//   headers: string[],
//   rows: Array<{value: string, confidence: number}[]>,
//   parseErrors?: Array<{row: number, error: string}>
// }
```

### Testing Best Practices
- Test webhook flows using debug endpoints
- Verify all document status transitions
- Check error handling for all external service failures
- Validate CSV parsing with edge cases
- Test authentication flows including password reset

## Authentication System

### Implementation Details
The application uses a complete custom authentication system:

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
- **Session persistence** across browser sessions (2-week rolling expiry)
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

## Deployment Notes (Replit)

### Replit Configuration
- Application runs on port 5000 (configured in `.replit`)
- PostgreSQL 16 module included
- Environment variables managed through Replit Secrets
- No need to run dev server - use Replit's built-in preview

### Important Replit Considerations
- Always use production build (`npm run build && npm start`)
- Database migrations run automatically on deployment
- Check Replit logs for webhook callback URLs
- Ensure all environment variables are set in Secrets