# N8N Webhook Documentation

This document describes all webhooks that N8N needs to call and the exact JSON payloads expected.

## 1. Upload Completion Webhook

**Endpoint**: `POST /api/webhook/n8n-completion`

**When to call**: After N8N finishes processing transactions in Salesforce

### Expected Payload Format

The webhook accepts multiple formats. Your N8N workflow can send any of these:

#### Format 1: Simple Array (Recommended)
```json
[
  {
    "documentId": "your-document-id-here",
    "carrierName": "Carrier Name",
    "numberOfSuccessful": 45,
    "numberOfFailed": 5,
    "totalTransactions": 50,
    "failedTransactions": [
      {
        "Producer_Name__c": "John Doe",
        "Policy__c": "POL123",
        "error": "Error message from Salesforce"
      },
      {
        "Producer_Name__c": "Jane Smith", 
        "Policy__c": "POL456",
        "error": "Another error message"
      }
    ]
  }
]
```

#### Format 2: Single Object
```json
{
  "documentId": "your-document-id-here",
  "carrierName": "Carrier Name",
  "numberOfSuccessful": 50,
  "numberOfFailed": 0,
  "totalTransactions": 50,
  "failedTransactions": []
}
```

#### Format 3: Nested Result
```json
{
  "result": {
    "documentId": "your-document-id-here",
    "carrierName": "Carrier Name",
    "numberOfSuccessful": 45,
    "numberOfFailed": 5,
    "totalTransactions": 50,
    "failedTransactions": [...]
  }
}
```

### Required Fields
- `documentId` (string): The document ID from the original upload request
- `carrierName` (string): Name of the carrier
- `numberOfSuccessful` (number): Count of successful transactions
- `numberOfFailed` (number): Count of failed transactions  
- `totalTransactions` (number): Total transactions attempted
- `failedTransactions` (array): Array of failed transaction details

### Failed Transaction Object
Each failed transaction should include:
- `Producer_Name__c` (string): Producer name
- `Policy__c` (string): Policy number
- `error` (string): Error message from Salesforce

## 2. Correction Completion Webhook

**Endpoint**: `POST /api/webhook/n8n-correction-completion`

**When to call**: After N8N finishes processing corrections in Salesforce

### Expected Payload Format

Same formats as above, but specifically for correction attempts:

```json
[
  {
    "documentId": "your-document-id-here",
    "carrierName": "Carrier Name",
    "numberOfSuccessful": 3,
    "numberOfFailed": 2,
    "totalTransactions": 5,
    "failedTransactions": [
      {
        "Producer_Name__c": "John Doe",
        "Policy__c": "POL123",
        "error": "Still failing after correction"
      }
    ]
  }
]
```

## 3. What Your N8N Flow Sends TO the App

### Initial Upload Request

Your app sends this to N8N when triggering upload:

**N8N Webhook URL**: `https://hwells4.app.n8n.cloud/webhook/832afa61-2bcc-433c-8df6-192009696764`

```json
{
  "documentId": "generated-uuid",
  "carrierName": "Carrier Name",
  "carrierId": "carrier-uuid",
  "csvData": [
    {
      "Producer_Name__c": "John Doe",
      "Policy__c": "POL123",
      "Premium__c": "1000.00",
      "Commission__c": "100.00",
      // ... other mapped fields
    }
  ],
  "mappedFields": {
    "Producer_Name__c": "Agent Name",
    "Policy__c": "Policy Number",
    // ... field mappings
  }
}
```

### Correction Request

**N8N Webhook URL**: `https://hwells4.app.n8n.cloud/webhook/commission-correction`

```json
{
  "documentId": "same-document-id",
  "carrierName": "Carrier Name",
  "corrections": [
    {
      "Producer_Name__c": "John Doe (Corrected)",
      "Policy__c": "POL123",
      "Premium__c": "1000.00",
      "Commission__c": "100.00",
      // ... corrected data
    }
  ]
}
```

## Important Notes for N8N Configuration

1. **Always send arrays**: Even for single results, wrap in array `[{...}]`
2. **Include all counts**: The app validates that `numberOfSuccessful + numberOfFailed = totalTransactions`
3. **Document ID is critical**: Must match the original document ID exactly
4. **Failed transactions**: Include enough info for users to identify and fix issues
5. **Use production URLs**: 
   - Upload: `https://hwells4.app.n8n.cloud/webhook/832afa61-2bcc-433c-8df6-192009696764`
   - Correction: `https://hwells4.app.n8n.cloud/webhook/commission-correction`

## Testing Your Webhooks

You can test webhook payloads using curl:

```bash
# Test completion webhook
curl -X POST http://your-app-url/api/webhook/n8n-completion \
  -H "Content-Type: application/json" \
  -d '[{
    "documentId": "test-123",
    "carrierName": "Test Carrier",
    "numberOfSuccessful": 10,
    "numberOfFailed": 0,
    "totalTransactions": 10,
    "failedTransactions": []
  }]'

# Test with webhook simulation endpoint
curl -X POST http://your-app-url/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "n8n-completion",
    "documentId": "test-123"
  }'
```

## Document Status Flow

Understanding status changes helps debug issues:

1. `salesforce_upload_pending` → User triggers upload
2. `uploading` → N8N webhook received, processing in Salesforce
3. `completed` → All transactions successful
4. `completed_with_errors` → Some transactions failed
5. `failed` → Critical error or all transactions failed

For corrections:
1. `completed_with_errors` → `correction_pending` → `completed` or `completed_with_errors`

## Debugging Tips

1. Check webhook logs: All webhook calls are logged with a unique webhook ID
2. Look for validation errors: The app validates all required fields
3. Transaction count mismatch: Ensure your counts add up correctly
4. Use test endpoints: `/api/test/webhook-endpoints` lists all available webhooks
5. Enable debug logging: All `/api/webhook/*` requests are logged

## Common Issues

1. **"Transaction count mismatch"**: Your numberOfSuccessful + numberOfFailed doesn't equal totalTransactions
2. **"Missing required fields"**: Check that all required fields are included
3. **"Document not found"**: The documentId doesn't match any existing document
4. **"Invalid payload format"**: Ensure you're sending valid JSON with correct structure