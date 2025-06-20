# PDF Processing System Documentation

## System Overview

This system allows users to upload PDF documents (commission statements or renewal reports) which are then processed through either standard markdown processing or JSON processing via external services. The system uses AWS S3 for file storage and a Railway service as an intermediary to handle Doctly API calls.

## Architecture

```
Frontend (React) 
    ↓ (PDF Upload)
AWS S3 (File Storage)
    ↓ (S3 Key/URL)
Backend (Express/Node.js)
    ↓ (S3 Details Payload)
Railway Service (External)
    ↓ (Downloads PDF, calls Doctly)
Doctly.ai (PDF Processing)
    ↓ (Processed Results)
Railway Service (Converts to CSV)
    ↓ (CSV saved to S3)
Backend (Webhook Receiver)
    ↓ (Status Update)
Frontend (Display CSV Data)
```

## Detailed Flow

### 1. Frontend Upload Process

**File**: `client/src/hooks/use-upload.ts` (lines 157-167)

1. User selects PDF file and processing method ("standard" or "json")
2. PDF uploaded to S3 via backend presigned URL
3. Document record created in database with status "uploaded"
4. Based on processing method selected:
   - **Standard**: Calls `AWSService.triggerPDFParser()`
   - **JSON**: Calls `AWSService.triggerDoctlyJsonParser()`

### 2. Frontend Service Layer

**File**: `client/src/lib/aws-service.ts`

- `triggerDoctlyJsonParser()` method calls backend endpoint
- Sends S3 key, document type, carrier ID, and document ID

### 3. Backend API Endpoints

**File**: `server/routes.ts`

#### Standard Processing Endpoint
- **URL**: `/api/pdf-parser/trigger`
- **Railway Target**: `https://pdfparser-production-f216.up.railway.app/parse`
- **Purpose**: Existing markdown processing

#### JSON Processing Endpoint (Current Focus)
- **URL**: `/api/doctly-json-parser/trigger` (lines 255-318)
- **Railway Target**: `https://pdfparser-production-f216.up.railway.app/parse-json`
- **Purpose**: New JSON processing via Doctly Insurance extractor

**Payload sent to Railway service:**
```json
{
  "s3_bucket": "converseinsurance",
  "s3_key": "uploads/carrier_1/uuid/filename.pdf",
  "webhook_url": "https://your-backend.replit.dev/api/doctly-json-webhook?document_id=123",
  "document_id": 123
}
```

**Authentication:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': process.env.API_KEY
}
```

### 4. Railway Service (External)

**Base URL**: `https://pdfparser-production-f216.up.railway.app`

#### Current Endpoints:
- `/parse` - Standard markdown processing (working)
- `/parse-json` - JSON processing (needs Doctly Insurance extractor update)

#### Railway Service Responsibilities:
1. Receives S3 details from backend
2. Downloads PDF file from S3 using S3 credentials
3. Calls appropriate Doctly API:
   - **Standard**: Existing Doctly markdown endpoint
   - **JSON**: **NEEDS UPDATE** to use Doctly Insurance extractor
4. Processes Doctly response
5. Converts result to CSV format
6. Saves CSV to S3
7. Sends webhook to backend with CSV S3 URL

### 5. Doctly Integration (What Railway Service Should Call)

#### Current Implementation (Standard)
- Uses existing Doctly markdown processing
- Converts markdown to CSV

#### **REQUIRED UPDATE (JSON Processing)**
Railway `/parse-json` endpoint should call:

**Doctly Insurance Extractor API:**
```bash
curl -X POST https://api.doctly.ai/api/v1/e/insurance \
  -H "Authorization: Bearer DOCTLY_API_KEY" \
  -F "file=@downloaded_pdf_file.pdf" \
  -F "callback_url=https://railway-service.up.railway.app/doctly-webhook-handler"
```

**Expected Doctly Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "file_name": "document.pdf",
  "status": "PENDING",
  "page_count": 12,
  "extractor": {
    "name": "Insurance",
    "slug": "insurance"
  }
}
```

**Doctly Webhook to Railway:**
```json
{
  "document_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "COMPLETED",
  "output_file_url": "https://...",
  "extractor": {
    "name": "Insurance",
    "slug": "insurance"
  }
}
```

### 6. Backend Webhook Receivers

**File**: `server/routes.ts`

#### Standard Processing Webhook
- **URL**: `/api/pdf-parse-webhook`
- **Receives**: Railway webhook with CSV URL

#### JSON Processing Webhook
- **URL**: `/api/doctly-json-webhook` (lines 408-484)
- **Receives**: Railway webhook with CSV URL

**Expected webhook payload from Railway:**
```json
{
  "status": "success" | "error",
  "csv_url": "https://converseinsurance.s3.us-east-2.amazonaws.com/processed/file.csv",
  "original_filename": "document.pdf",
  "message": "Optional error message"
}
```

### 7. Frontend Display

- Backend updates document status to "review_pending"
- Frontend polls document status
- When ready, frontend displays CSV data for user review

## File Structure

```
project/
├── client/src/
│   ├── hooks/use-upload.ts          # Upload logic & processing method selection
│   └── lib/aws-service.ts           # Frontend service calls
├── server/
│   └── routes.ts                    # Backend API endpoints & webhooks
├── shared/
│   └── schema.ts                    # Zod validation schemas
└── Railway Service (External)       # PDF processing intermediary
    ├── /parse                       # Standard processing (working)
    └── /parse-json                  # JSON processing (needs update)
```

## Environment Variables

### Backend (this system)
```bash
API_KEY=railway_service_authentication_key
AWS_ACCESS_KEY_ID=s3_access_key
AWS_SECRET_ACCESS_KEY=s3_secret_key
AWS_S3_BUCKET_NAME=converseinsurance
AWS_REGION=us-east-2
```

### Railway Service (external)
```bash
API_KEY=same_as_backend_api_key
DOCTLY_API_KEY=bearer_token_for_doctly_insurance_extractor
AWS_ACCESS_KEY_ID=s3_access_for_downloading_pdfs
AWS_SECRET_ACCESS_KEY=s3_secret_for_downloading_pdfs
```

## Current Status

### ✅ Working (Standard Processing)
- Frontend upload → S3 → Backend → Railway `/parse` → Doctly (markdown) → CSV → Frontend

### 🔄 Needs Update (JSON Processing)
- Frontend upload → S3 → Backend → Railway `/parse-json` → **[PLACEHOLDER]** → CSV → Frontend

## Required Railway Service Update

The Railway service `/parse-json` endpoint currently has placeholder Doctly integration and needs to be updated to:

1. **Replace placeholder Doctly call** with actual Insurance extractor API
2. **Use multipart form-data** to send PDF file to Doctly
3. **Handle Doctly webhook** for completion notification
4. **Convert JSON response** to CSV format (same as current markdown processing)
5. **Return same webhook format** to backend

## Key Points

1. **No changes needed** to frontend or backend code
2. **Only Railway service** needs updating for JSON processing
3. **Same CSV output format** ensures frontend compatibility
4. **Existing authentication** and webhook patterns remain unchanged
5. **S3 integration** for file storage and CSV output stays the same

## API Authentication Flow

```
Frontend → Backend (internal)
Backend → Railway (X-API-Key: process.env.API_KEY)
Railway → Doctly (Authorization: Bearer DOCTLY_API_KEY)
Railway → S3 (AWS credentials)
Railway → Backend Webhook (no auth required, internal URL)
```

## Testing

To test the system:

1. Upload PDF via frontend with "JSON processing" selected
2. Check backend logs for Railway service call
3. Railway service should download PDF and call Doctly Insurance extractor
4. Railway service should convert JSON to CSV and webhook back
5. Frontend should display processed CSV data

## Next Steps

1. **Update Railway service** `/parse-json` endpoint with Doctly Insurance extractor integration
2. **Test end-to-end flow** with sample PDFs
3. **Monitor processing** and error handling
4. **Compare results** between standard and JSON processing methods 