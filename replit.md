# Overview

Converse AI Hub is a full-stack insurance document processing platform that automates the extraction and processing of commission statements and renewal reports. The system allows users to upload PDF documents, processes them through AI-powered extraction services, and integrates with Salesforce via N8N workflows. It features a complete authentication system, real-time document management, and provides confidence-based data review capabilities for quality assurance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development builds
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens for consistent theming
- **State Management**: TanStack Query for server state management and React hooks for local state
- **Authentication**: Custom session-based authentication with protected routes

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript for type safety across the full stack
- **Database ORM**: Drizzle ORM for type-safe database operations and schema management
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Authentication**: Custom bcrypt-based password hashing with invitation token system
- **File Processing**: Multi-service PDF processing pipeline with confidence scoring

## Data Storage Solutions
- **Primary Database**: PostgreSQL with the following core tables:
  - `users` - User accounts with authentication credentials
  - `invitation_tokens` - Invitation-only registration system
  - `documents` - Document metadata, processing status, and file references
  - `carriers` - Insurance carrier information with Salesforce integration
- **File Storage**: AWS S3 for document storage with presigned URLs for secure uploads
- **Document Processing**: Processed files stored in S3 with structured paths (`processed/{carrierId}/{uuid}/`)

## Authentication and Authorization
- **Session-Based Auth**: Server-side sessions stored in PostgreSQL with secure HTTP-only cookies
- **Invitation System**: Registration requires valid invitation tokens to control access
- **Password Security**: bcrypt hashing with salt rounds for password storage
- **Password Reset**: Secure token-based password reset flow with expiring tokens
- **Middleware Protection**: Route-level authentication middleware for protected endpoints

## External Dependencies

### Document Processing Services
- **Railway PDF Processing Service**: External microservice at `pdfparser-production-f216.up.railway.app` that orchestrates document processing
- **Doctly.ai Integration**: AI-powered document extraction service with two processing modes:
  - Standard markdown processing via `/documents/` endpoint
  - Specialized JSON extraction via `/e/insurance` endpoint for insurance documents
- **AWS Lambda Functions**: Textract integration for PDF analysis with spatial coordinate processing

### Storage and Infrastructure
- **AWS S3**: Document storage with bucket `converseinsurance` in `us-east-2` region
- **AWS Textract**: OCR and document analysis service for extracting structured data from PDFs
- **PostgreSQL**: Primary database (likely Neon or similar cloud PostgreSQL service)

### Integration Services
- **N8N Workflow Platform**: Automation platform for Salesforce data upload workflows
- **Salesforce**: CRM integration for storing processed commission and transaction data
- **Webhook System**: Standardized webhook handlers for N8N completion notifications and status updates

### Development and Deployment
- **Replit Environment**: Development and hosting platform with custom domain support
- **Environment Variables**: Secure credential management for API keys and database connections
- **Session Store**: PostgreSQL-backed session storage for scalable authentication