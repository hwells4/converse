# Current System Analysis: PDF Processing & Doctly.ai Integration

## Overview
This system is a PDF processing platform where users upload PDFs, which are processed through a Railway service that integrates with Doctly.ai. The analysis below represents the **current state** as of the comprehensive codebase review.

## Current Implementation Status (As of Codebase Review)

### ✅ **Currently Working**
1. **PDF Upload Flow**: Users can upload PDF files through drag & drop interface
2. **S3 Integration**: Files are uploaded to S3 bucket `converseinsurance` via presigned URLs
3. **Railway PDF Processing**: Backend triggers Railway service for PDF → CSV conversion
4. **Doctly Integration**: Railway service calls Doctly.ai (markdown endpoint) for PDF processing
5. **Webhook Processing**: Railway returns results via webhook to backend
6. **Document Management**: Full CRUD operations for documents with status tracking
7. **Database**: PostgreSQL with Drizzle ORM, proper schema for documents/carriers
8. **Frontend**: React with upload modal, document management, CSV preview

### ❌ **Not Yet Implemented** (JSON Integration Goals)
1. **JSON Processing Method**: No option to choose between standard and JSON processing
2. **Doctly JSON Endpoint**: No integration with Doctly's JSON endpoint
3. **Railway JSON Route**: Railway service lacks `/parse-json` endpoint
4. **Backend JSON Endpoints**: Missing `doctly-json-parser` endpoints
5. **Frontend Processing Selection**: Upload modal doesn't offer processing method choice

### 🟡 **Partially Implemented** (Existing Infrastructure)
1. **CSV/XLSX Support**: Upload modal supports CSV/XLSX but goes directly to field mapping
2. **Field Mapping**: Has spreadsheet field mapping wizard (could support JSON data)
3. **N8N Integration**: Salesforce upload workflow exists (could work with JSON data)

## Current Architecture

### 1. **Railway Service (External)**
- **URL**: `https://pdfparser-production-f216.up.railway.app/parse`
- **Function**: Already contains doctly.ai integration
- **Evidence**: From attached logs showing `doctly_client:Processing PDF with Doctly`

### 2. **Your Backend Integration** (`server/routes.ts`)

#### **Trigger Endpoint**: `/api/pdf-parser/trigger`
```javascript
// Current payload to Railway service:
{
  s3_bucket: "converseinsurance",
  s3_key: s3Key,
  webhook_url: `${webhookUrl}?document_id=${documentId}`,
  document_id: documentId
}

// Authentication:
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': process.env.API_KEY,  // <-- This is your bearer token pattern
}
```

#### **Webhook Receiver**: `/api/pdf-parse-webhook`
```javascript
// Railway service returns:
{
  status: "success" | "error",
  csv_url: "https://converseinsurance.s3.../file.csv", // Optional
  original_filename: "filename.pdf",
  message: "error message" // Optional
}
```

### 3. **Frontend Integration** (`client/src/hooks/use-upload.ts`)

#### **Upload Flow for PDFs**:
1. User uploads PDF → S3 via presigned URL
2. Document record created with status: "uploaded"
3. **Frontend calls**: `AWSService.triggerPDFParser()` 
4. **Backend calls**: Railway service at `/parse` endpoint
5. **Railway service**: Processes PDF through doctly.ai internally
6. **Railway service**: Returns CSV via webhook to your backend
7. **Your backend**: Updates document status to "review_pending"
8. **Frontend**: Polls document status until complete

### 4. **Current Data Flow**

```
Frontend Upload
    ↓
S3 Storage (PDF)
    ↓ 
Your Backend (/api/pdf-parser/trigger)
    ↓
Railway Service (/parse) 
    ↓ [INTERNAL]
Railway → Doctly.ai (existing integration)
    ↓ [INTERNAL]
Railway → Processes doctly response 
    ↓
Railway Webhook → Your Backend (/api/pdf-parse-webhook)
    ↓
Database Update (CSV S3 location)
    ↓
Frontend Polling → CSV Ready for Review
```

## Key Findings

### **Authentication Pattern**
- **Railway Service**: Uses `X-API-Key` header with `process.env.API_KEY`
- **NOT Bearer token** - it's API key in custom header

### **Response Format** 
- **Railway returns**: CSV URL (file-based)
- **You want**: JSON data (direct data for display)

### **Current Limitations**
1. Railway service only returns CSV files via S3
2. No "accuracy" parameter in current Railway payload
3. No direct JSON response - everything goes through S3 files

## What You Actually Need

**FINAL CORRECTED UNDERSTANDING:**

You want to **create a DUPLICATE processing flow** with these specifics:

1. **Keep existing Railway service unchanged** (for backward compatibility)
2. **Create NEW endpoint** that copies the existing flow exactly
3. **Only difference**: New flow calls different doctly.ai service that returns JSON
4. **Railway processes JSON → CSV** (instead of Markdown → CSV) 
5. **Frontend gets same CSV response** as existing flow
6. **Result**: Two processing options, both return CSV to frontend

### **Existing Flow (keep unchanged):**
```
Frontend Upload → S3 → Backend (/api/pdf-parser/trigger) → Railway (/parse) 
→ Doctly.ai (markdown endpoint) → Railway processes markdown → CSV 
→ Railway webhook → Backend (/api/pdf-parse-webhook) → Frontend gets CSV
```

### **New Flow (duplicate with different doctly endpoint):**
```
Frontend Upload → S3 → Backend (/api/NEW-endpoint/trigger) → Railway (/NEW-parse-route)
→ Doctly.ai (JSON endpoint) → Railway converts JSON to CSV → CSV
→ Railway webhook → Backend (/api/NEW-webhook) → Frontend gets CSV
```

### **Target JSON Response** (from new doctly service):
```json
[
  {
    "insured_name": "HIERHOLZER L.",
    "policy_number": "919222629", 
    "transaction_amount": "-34.66",
    "transaction_type": "CR",
    "transaction_date": "2025-04-10"
  }
]
```

### **Implementation Plan:**

1. **Backend**: Create new endpoint `/api/doctly-json-parser/trigger` (copy of pdf-parser)
2. **Backend**: Create new webhook `/api/doctly-json-webhook` (copy of pdf-parse-webhook)  
3. **Railway**: Create new route `/parse-json` that calls new doctly service
4. **Railway**: Convert JSON response to CSV format and return via webhook
5. **Frontend**: Add option to choose between "Standard Processing" vs "JSON Processing"

## Detailed Implementation Guide

### **Step 1: Backend Endpoints** (`server/routes.ts`)

#### **1.1 Add New Schema** (after existing pdfParserTriggerSchema):
```javascript
const doctlyJsonParserTriggerSchema = z.object({
  s3Key: z.string().min(1),
  documentType: z.enum(["commission", "renewal"]),
  carrierId: z.number().positive(),
  documentId: z.number().positive(),
});
```

#### **1.2 Create New Trigger Endpoint** (copy of `/api/pdf-parser/trigger`):
```javascript
// Doctly JSON Parser service trigger endpoint
app.post("/api/doctly-json-parser/trigger", async (req, res) => {
  // Copy exact logic from pdf-parser/trigger
  // Only difference: change Railway URL from /parse to /parse-json
  const response = await fetch('https://pdfparser-production-f216.up.railway.app/parse-json', {
    // ... same headers and payload
  });
});
```

#### **1.3 Create New Webhook** (copy of `/api/pdf-parse-webhook`):
```javascript
app.post("/api/doctly-json-webhook", async (req, res) => {
  // Copy exact logic from pdf-parse-webhook
  // Same schema validation, same database updates
});
```

### **Step 2: Schema Updates** (`shared/schema.ts`)

#### **2.1 Add New Webhook Schema** (copy existing pdfParserWebhookSchema):
```javascript
export const doctlyJsonWebhookSchema = z.object({
  status: z.enum(["success", "error"]),
  csv_url: z.string().url().optional(),
  original_filename: z.string().min(1),
  message: z.string().optional(),
});
```

### **Step 3: Frontend Integration**

#### **3.1 AWS Service** (`client/src/lib/aws-service.ts`)
Add new method copying `triggerPDFParser()`:
```javascript
static async triggerDoctlyJsonParser({ s3Key, documentType, carrierId, documentId }) {
  // Copy exact logic, change URL to /api/doctly-json-parser/trigger
}
```

#### **3.2 Upload Hook** (`client/src/hooks/use-upload.ts`)
Add processing method parameter:
```javascript
const uploadFile = async (
  file: File, 
  documentType: "commission" | "renewal", 
  carrierId: number,
  customFileName?: string,
  processingMethod?: "standard" | "json"  // <-- ADD THIS
) => {
  // Add logic to choose between triggerPDFParser vs triggerDoctlyJsonParser
}
```

#### **3.3 Upload Modal**
Add processing method selection (radio buttons or dropdown)

### **Step 4: Railway Service Updates**

#### **4.1 Add New Route** `/parse-json` (copy existing `/parse` route)
#### **4.2 Replace Doctly.ai Call:**
- **Current**: Calls markdown endpoint → processes markdown → CSV
- **New**: Calls JSON endpoint → converts JSON to CSV → same CSV response

#### **4.3 JSON to CSV Conversion Logic:**
```python
# Convert JSON array to CSV
def json_to_csv(json_data):
    headers = ["Insured Name", "Policy Number", "Transaction Amount", "Transaction Type", "Transaction Date"]
    rows = []
    for item in json_data:
        rows.append([
            item["insured_name"],
            item["policy_number"], 
            item["transaction_amount"],
            item["transaction_type"],
            item["transaction_date"]
        ])
    return create_csv(headers, rows)
```

### **Step 5: Environment Variables**

#### **Required Environment Variables:**
- `API_KEY` - Already exists for Railway authentication
- `DOCTLY_API_KEY` - For new doctly.ai JSON endpoint (if different)

### **Step 6: Testing Checklist**

1. **Upload Flow**: Verify file upload to S3 works for both methods
2. **Trigger**: Test both `/api/pdf-parser/trigger` and `/api/doctly-json-parser/trigger`
3. **Railway**: Verify both `/parse` and `/parse-json` routes work
4. **Webhooks**: Test both webhook endpoints receive correct responses
5. **Database**: Verify document status updates correctly for both flows
6. **Frontend**: Test processing method selection and polling

### **Step 7: File Locations**

**Files to Modify:**
- `server/routes.ts` - Add new endpoints
- `shared/schema.ts` - Add new schemas  
- `client/src/lib/aws-service.ts` - Add new trigger method
- `client/src/hooks/use-upload.ts` - Add processing method parameter
- Upload modal component - Add processing method selection
- Railway service code - Add new route and JSON processing

## Next Steps

1. **You provide**: The exact new doctly.ai JSON API endpoint URL and payload format
2. **Developer implements**: Following the detailed guide above
3. **Testing**: Use checklist to verify both flows work independently

## Railway System Access Requirements

Based on the current implementation analysis, **Railway service modifications are required** to implement JSON processing. The existing Railway service at `https://pdfparser-production-f216.up.railway.app` needs:

### Required Railway Changes:
1. **New Route**: `/parse-json` endpoint (copy of existing `/parse`)
2. **Doctly JSON Integration**: Replace markdown endpoint call with JSON endpoint
3. **JSON to CSV Conversion**: Process JSON response and convert to CSV format
4. **Same Webhook Response**: Return CSV via same webhook format as existing flow

### Current Railway Service Analysis:
- **Authentication**: Uses `X-API-Key` header with `process.env.API_KEY`
- **S3 Integration**: Downloads from `converseinsurance` bucket
- **Webhook Format**: Returns `{status, csv_url, original_filename, message}`
- **Processing Flow**: PDF → Doctly (markdown) → CSV → S3 upload → webhook

### What I Need from You:

1. **Railway Access**: Access to the Railway project to add the `/parse-json` endpoint
2. **Doctly JSON Endpoint**: URL and payload format for the JSON endpoint
3. **API Key**: Whether to use same `DOCTLY_API_KEY` or different one for JSON endpoint
4. **Testing**: Ability to test the new Railway endpoint before frontend integration

## Implementation Plan (Railway Access Required)

### Phase 1: Railway Service Updates (Need Access)
1. Add `/parse-json` route copying existing `/parse` logic
2. Replace Doctly markdown call with JSON endpoint call  
3. Add JSON → CSV conversion logic
4. Test new endpoint with existing webhook response format

### Phase 2: Backend Integration (Can Do Now)
1. Add `doctly-json-parser` endpoints in `server/routes.ts`
2. Add new schemas in `shared/schema.ts`
3. Add `triggerDoctlyJsonParser` method in `aws-service.ts`

### Phase 3: Frontend Integration (Can Do Now)
1. Add processing method selection to upload modal
2. Update upload hook to support processing method parameter
3. Test both processing flows

## Environment Variables Required

```env
# Existing (already configured)
API_KEY=your_railway_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-2
AWS_S3_BUCKET_NAME=converseinsurance

# New (may be needed)
DOCTLY_JSON_API_KEY=your_doctly_json_key  # If different from existing
```

## Next Steps

**Immediate Action Required:**
1. **Grant Railway Access**: Add me to Railway project to implement `/parse-json` endpoint
2. **Provide Doctly JSON Details**: Share the JSON endpoint URL and payload format
3. **Verify Current System**: Confirm existing PDF processing is working correctly

**Once Railway Access Granted:**
1. Implement Railway JSON endpoint (30 minutes)
2. Add backend JSON endpoints (30 minutes) 
3. Add frontend processing selection (45 minutes)
4. End-to-end testing (30 minutes)

**Total Estimated Time**: 2-3 hours once Railway access is provided.