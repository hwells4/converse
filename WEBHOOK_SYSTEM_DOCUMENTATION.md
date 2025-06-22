# N8N Webhook System Documentation

## Overview

The new standardized N8N webhook system provides a reliable, unified interface for receiving webhook updates from N8N workflows. This system eliminates the previous issues with route conflicts, payload parsing, and error handling.

## ✅ Frontend Integration Status

**YES, the system is fully integrated with your frontend:**

- **Real-time Updates**: Frontend polls for document status changes every 5 seconds (`/client/src/hooks/use-documents.ts:9`)
- **Automatic Refresh**: When webhooks update document status, the frontend automatically sees the changes
- **Failed Transactions UI**: The `FailedTransactionsReview` component already handles the failed transactions JSON structure
- **Status Badges**: Document status updates (completed, completed_with_errors, failed) are displayed in real-time
- **No frontend changes needed**: The webhook system maintains the same database schema and API responses

## 📡 Webhook Endpoints

### 1. N8N Completion Webhook
**Endpoint**: `POST /api/webhook/n8n-completion`

**Purpose**: Handles final completion notifications from N8N Salesforce upload workflows

**Expected Payload Formats** (all supported):

```json
// Format 1: Direct object
{
  "documentId": 123,
  "status": "completed_with_errors",
  "completionData": {
    "carrierName": "Test Carrier",
    "numberOfSuccessful": 8,
    "totalTransactions": 10,
    "failedTransactions": [
      {
        "type": "policy_not_found",
        "error": "Policy not found in Salesforce",
        "policyNumber": "ABC-123",
        "transactionAmount": "100.00",
        "originalData": {
          "Policy Number": "ABC-123",
          "Name of Insured": "John Doe",
          "Transaction Amount": "100.00",
          "Commission Statement": "STMT-001"
        }
      }
    ],
    "message": "8 of 10 transactions completed successfully",
    "completedAt": "2024-01-15T10:30:00Z"
  }
}

// Format 2: N8N Array format (system takes first element)
[{
  "documentId": 123,
  "status": "completed_with_errors",
  "completionData": { ... }
}]

// Format 3: Nested results format
{
  "results": [{
    "documentId": 123,
    "status": "completed_with_errors", 
    "completionData": { ... }
  }]
}
```

### 2. N8N Correction Completion Webhook
**Endpoint**: `POST /api/webhook/n8n-correction-completion`

**Purpose**: Handles results from N8N correction workflows when resubmitting failed transactions

**⚠️ IMPORTANT**: To properly match corrections to original failed transactions, N8N must include the `originalPolicyNumber` field in the results.

**Expected Payload Format**:

```json
{
  "documentId": 123,
  "totalProcessed": 2,
  "successCount": 1,
  "failureCount": 1,
  "results": {
    "successful": [
      {
        "transactionId": "a05am000009N5Q1AAK",
        "policyNumber": "ABC-123",           // ✅ CORRECTED policy number
        "originalPolicyNumber": "WRONG-123", // ✅ ORIGINAL (wrong) policy number - REQUIRED!
        "amount": 100.00,
        "policyId": "006am000008JoxXAAS"
      }
    ],
    "failed": [
      {
        "policyNumber": "DEF-456",           // ✅ CORRECTED policy number (attempted)
        "originalPolicyNumber": "INVALID-456", // ✅ ORIGINAL (wrong) policy number - REQUIRED!
        "error": "Policy still not found after correction",
        "originalData": {
          "policyNumber": "DEF-456",
          "insuredName": "Jane Smith", 
          "transactionAmount": 200.00,
          "statementId": "STMT-001"
        }
      }
    ]
  },
  "summary": "Processed 2 corrections: 1 successful, 1 failed"
}
```

**🔑 Key Points for N8N Configuration**:
- **originalPolicyNumber** is the policy number that was originally wrong and caused the failure
- **policyNumber** is the corrected policy number the user provided
- The system matches corrections back to failed transactions using **originalPolicyNumber**
- Without **originalPolicyNumber**, the system cannot identify which failed transactions were corrected

## 🔧 N8N Configuration Requirements

### 1. Webhook URLs to Use

**Production URLs** (update these in your N8N workflows):
- Completion webhook: `https://your-domain.com/api/webhook/n8n-completion`
- Correction webhook: `https://your-domain.com/api/webhook/n8n-correction-completion`

### 2. Required N8N Workflow Updates

#### A. Main Salesforce Upload Workflow
**At the end of your main upload workflow, send a completion webhook:**

```json
// HTTP Request Node Configuration
{
  "method": "POST",
  "url": "https://your-domain.com/api/webhook/n8n-completion",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "documentId": "{{ $('Start').item.json.documentId }}",
    "status": "{{ $('Determine Status').item.json.status }}", // "completed" or "completed_with_errors"
    "completionData": {
      "carrierName": "{{ $('Get Carrier').item.json.name }}",
      "numberOfSuccessful": "{{ $('Count Successful').item.json.count }}",
      "totalTransactions": "{{ $('Count Total').item.json.count }}",
      "failedTransactions": "{{ $('Collect Failed').item.json.failed }}",
      "message": "{{ $('Build Message').item.json.message }}",
      "completedAt": "{{ $now }}"
    }
  }
}
```

#### B. Correction Workflow (for resubmitting failed transactions)
**CRITICAL**: Your correction workflow MUST preserve and return the `originalPolicyNumber` from the input data.

**Input to N8N correction workflow** (what our system sends):
```json
{
  "transactions": [
    {
      "originalFailedTransactionIndex": 0,
      "originalPolicyNumber": "WRONG-123",    // ⚠️ This is the wrong policy number
      "policyNumber": "CORRECT-123",          // ⚠️ This is the corrected policy number
      "statementId": "STMT-001",
      "insuredName": "John Doe",
      "transactionAmount": "100.00"
    }
  ],
  "webhookUrl": "https://your-domain.com/api/webhook/n8n-correction-completion",
  "documentId": 123
}
```

**Output from N8N correction workflow** (what you need to send back):
```json
// HTTP Request Node Configuration
{
  "method": "POST", 
  "url": "{{ $('Start').item.json.webhookUrl }}",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "documentId": "{{ $('Start').item.json.documentId }}",
    "totalProcessed": "{{ $('Count Processed').item.json.total }}",
    "successCount": "{{ $('Count Successful').item.json.count }}",
    "failureCount": "{{ $('Count Failed').item.json.count }}",
    "results": {
      "successful": [
        {
          "transactionId": "{{ $item.salesforceTransactionId }}",
          "policyNumber": "{{ $item.correctedPolicyNumber }}",
          "originalPolicyNumber": "{{ $item.originalPolicyNumber }}", // ⚠️ REQUIRED!
          "amount": "{{ $item.amount }}",
          "policyId": "{{ $item.salesforcePolicyId }}"
        }
      ],
      "failed": [
        {
          "policyNumber": "{{ $item.attemptedPolicyNumber }}",
          "originalPolicyNumber": "{{ $item.originalPolicyNumber }}", // ⚠️ REQUIRED!
          "error": "{{ $item.errorMessage }}",
          "originalData": {
            "policyNumber": "{{ $item.attemptedPolicyNumber }}",
            "insuredName": "{{ $item.insuredName }}",
            "transactionAmount": "{{ $item.amount }}",
            "statementId": "{{ $item.statementId }}"
          }
        }
      ]
    },
    "summary": "Processed {{ $('Count Processed').item.json.total }} corrections"
  }
}
```

**⚠️ N8N Implementation Notes:**
1. **Preserve originalPolicyNumber**: Store the `originalPolicyNumber` from input and include it in all results
2. **Use corrected policyNumber**: Use the `policyNumber` (corrected value) for Salesforce lookups
3. **Return both values**: Always return both `originalPolicyNumber` and `policyNumber` in results
4. **Match by original**: Our system uses `originalPolicyNumber` to identify which failed transaction was corrected

### 3. Status Values to Use

**For completion webhook (`status` field):**
- `"completed"` - All transactions succeeded
- `"completed_with_errors"` - Some transactions failed
- `"failed"` - Entire process failed

**The system automatically determines the correct status based on failed transactions count.**

## 🎯 Failed Transaction JSON Support

**YES, the system fully handles failed transactions JSON including:**

✅ **Complete transaction details** with original data
✅ **Error messages** for each failed transaction  
✅ **Policy numbers** and transaction amounts
✅ **Nested originalData** structure for frontend display
✅ **Automatic correction workflow** integration
✅ **Smart transaction counting** (avoids double-counting corrected items)

The failed transactions are stored in this exact format:
```json
{
  "type": "policy_not_found",
  "error": "Policy not found in Salesforce", 
  "insuredName": "John Doe",
  "statementId": "STMT-001",
  "originalData": {
    "Policy Name": null,
    "Policy Number": "ABC-123",
    "Name of Insured": "John Doe", 
    "Transaction Type": "Commission",
    "Transaction Amount": "100.00",
    "Commission Statement": "STMT-001"
  },
  "policyNumber": "ABC-123",
  "transactionAmount": "100.00",
  "commissionStatementId": "STMT-001"
}
```

## 🧪 Testing Endpoints

### Test N8N Completion Webhook
```bash
POST /api/test/n8n-completion
{
  "documentId": 123,
  "status": "completed_with_errors",
  "numberOfSuccessful": 8,
  "totalTransactions": 10
}
```

### Test N8N Correction Webhook  
```bash
POST /api/test/n8n-correction
{
  "documentId": 123,
  "totalProcessed": 2,
  "successCount": 1,
  "failureCount": 1
}
```

### List All Webhook Endpoints
```bash
GET /api/test/webhook-endpoints
```

## 🔍 System Features

### 1. Standardized Logging
- **Unique webhook IDs** for tracking requests
- **Detailed payload logging** for debugging
- **Performance metrics** (processing time)
- **Consistent error reporting**

### 2. Flexible Payload Handling
- **Multiple format support** (object, array, nested)
- **Automatic format detection** and normalization
- **Graceful fallbacks** for missing fields
- **Schema validation** with helpful error messages

### 3. Robust Error Handling
- **Proper HTTP status codes** (400 for validation, 500 for server errors)
- **Detailed error responses** with context
- **Validation error breakdown** for debugging
- **Database transaction integrity** checks

### 4. Frontend Integration
- **Real-time status updates** via polling
- **Failed transaction review** interface
- **Automatic UI refresh** when webhooks complete
- **Toast notifications** for user feedback

## 🚀 Deployment Checklist

### 1. Server Deployment
- [ ] Deploy new webhook routes
- [ ] Verify endpoints are accessible
- [ ] Test with sample payloads
- [ ] Check logging output

### 2. N8N Workflow Updates
- [ ] Update completion webhook URLs
- [ ] Update correction webhook URLs  
- [ ] Test webhook calls from N8N
- [ ] Verify payload formats match expectations

### 3. System Verification
- [ ] Test end-to-end document processing
- [ ] Verify frontend status updates
- [ ] Test failed transaction corrections
- [ ] Check webhook debug logs

## 📞 Troubleshooting

### Common Issues

1. **Webhook not receiving data**
   - Check N8N webhook URL configuration
   - Verify HTTP method is POST
   - Check network connectivity

2. **Payload validation errors**
   - Review webhook logs for validation details
   - Use test endpoints to verify payload format
   - Check N8N output node configuration

3. **Frontend not updating**
   - Verify webhook is successfully updating database
   - Check if polling is working (5-second intervals)
   - Clear browser cache and refresh

4. **Failed transactions not displaying**
   - Verify `failedTransactions` array in webhook payload
   - Check `metadata.completionData` in database
   - Review frontend FailedTransactionsReview component

5. **⚠️ Correction webhook not removing failed transactions properly**
   - **Symptom**: Correction webhook shows success but failed transaction count doesn't decrease
   - **Cause**: Missing `originalPolicyNumber` in N8N response - system can't match corrections to original failures
   - **Solution**: Update N8N correction workflow to include `originalPolicyNumber` field in results
   - **Debug**: Check webhook logs for "CORRECTION DEBUG" messages showing policy number matching
   - **Example**: If original failed transaction had policy `"WRONG-123"` and user corrected it to `"ABC-123"`, N8N must send back:
     ```json
     {
       "policyNumber": "ABC-123",        // Corrected number
       "originalPolicyNumber": "WRONG-123" // Original wrong number - REQUIRED!
     }
     ```

### Debug Commands

```bash
# Test webhook connectivity
curl -X POST http://localhost:5000/api/test/webhook-endpoints

# Test N8N completion webhook
curl -X POST http://localhost:5000/api/test/n8n-completion \
  -H "Content-Type: application/json" \
  -d '{"documentId": 1}'

# Check webhook logs
# Look for entries with format: [webhook-id] in server logs
```

## 🎉 Benefits of New System

1. **Eliminated Route Conflicts** - Single source of truth for N8N webhooks
2. **Simplified Debugging** - Consistent logging with unique IDs
3. **Flexible Payload Support** - Handles multiple N8N output formats
4. **Better Error Handling** - Clear error messages and proper status codes
5. **Easier Testing** - Built-in test endpoints for verification
6. **Maintained Compatibility** - No frontend changes required
7. **Robust Failed Transaction Support** - Complete JSON structure handling

The system is production-ready and should eliminate the webhook frustrations you've been experiencing!