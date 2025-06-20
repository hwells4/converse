# Webhook  Body
{
  "success": {{ $json.failedTransactions.length === 0 }},
  "message": "{{$json.message}}",
  "document": {
    "id": {{$json.documentId}},
    "filename": "{{$json.carrierName}}_statement.pdf",
    "originalName": "{{$json.carrierName}}_statement.pdf",
    "documentType": "commission",
    "carrierId": {{$json.carrierId}},
    "s3Key": "processed/{{$json.documentId}}/statement.pdf",
    "s3Url": "https://converseinsurance.s3.us-east-2.amazonaws.com/processed/{{$json.documentId}}/statement.pdf",
    "fileSize": 1024000,
    "status": "{{ $json.failedTransactions.length > 0 ? 'completed_with_errors' : 'completed' }}",
    "textractJobId": "textract-job-{{$json.documentId}}",
    "csvS3Key": "processed/{{$json.documentId}}/transactions.csv",
    "csvUrl": "https://converseinsurance.s3.us-east-2.amazonaws.com/processed/{{$json.documentId}}/transactions.csv",
    "jsonS3Key": "processed/{{$json.documentId}}/data.json",
    "jsonUrl": "https://converseinsurance.s3.us-east-2.amazonaws.com/processed/{{$json.documentId}}/data.json",
    "processingError": null,
    "metadata": {
      "completionData": {
        "message": "{{$json.message}}",
        "carrierName": "{{$json.carrierName}}",
        "completedAt": "{{new Date().toISOString()}}",
        "totalTransactions": {{$json.totalTransactions}},
        "failedTransactions": {{JSON.stringify($json.failedTransactions)}},
        "numberOfSuccessful": {{$json.numberOfSuccessful}},
        "correctionData": {{JSON.stringify($json.correctionData)}}
      }
    },
    "uploadedAt": "{{new Date().toISOString()}}",
    "processedAt": "{{new Date().toISOString()}}"
  }
}


# Example
[
  {
    "success": true,
    "message": "All documents processed successfully",
    "results": [
      {
        "documentId": 51,
        "success": true,
        "message": "Document status updated to completed",
        "document": {
          "id": 51,
          "filename": "2025-06-20_nationwide_commissions_april_2025",
          "originalName": "Nationwide Commissions April 2025.pdf",
          "documentType": "commission",
          "carrierId": 66,
          "s3Key": "uploads/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750443362825.pdf",
          "s3Url": "https://converseinsurance.s3.us-east-2.amazonaws.com/uploads/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750443362825.pdf",
          "fileSize": 67813,
          "status": "completed",
          "textractJobId": null,
          "csvS3Key": "processed/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750443362825.csv",
          "csvUrl": "https://s3-us-east-2.amazonaws.com/converseinsurance/processed/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750443362825.csv",
          "jsonS3Key": null,
          "jsonUrl": null,
          "processingError": null,
          "metadata": {
            "completionData": {
              "message": "11 of 12 transactions completed. 1 had invalid policy numbers.",
              "carrierName": "Nationwide Insurance",
              "completedAt": "2025-06-20T19:06:04.036Z",
              "totalTransactions": 12,
              "failedTransactions": [
                {
                  "type": "policy_not_found",
                  "error": "No policy found for 7842HR250kg91m",
                  "insuredName": null,
                  "statementId": "a06am00000CWJWrAAP",
                  "originalData": {
                    "Policy Name": null,
                    "Policy Number": "7842HR250kg91m",
                    "Name of Insured": null,
                    "Transaction Type": null,
                    "Transaction Amount": "9.28",
                    "Commission Statement": "a06am00000CWJWrAAP"
                  },
                  "policyNumber": "7842HR250kg91m",
                  "transactionAmount": "9.28",
                  "commissionStatementId": "a06am00000CWJWrAAP"
                }
              ],
              "numberOfSuccessful": 11
            }
          },
          "uploadedAt": "2025-06-20T18:16:03.861Z",
          "processedAt": "2025-06-20T18:16:36.349Z"
        }
      }
    ]
  }
]

# Test Result
[
  {
    "success": true,
    "message": "All documents processed successfully",
    "results": [
      {
        "documentId": 53,
        "success": true,
        "message": "Document status updated to completed",
        "document": {
          "id": 53,
          "filename": "2025-06-20_nationwide_commissions_april_2025",
          "originalName": "Nationwide Commissions April 2025.pdf",
          "documentType": "commission",
          "carrierId": 66,
          "s3Key": "uploads/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750449558956.pdf",
          "s3Url": "https://converseinsurance.s3.us-east-2.amazonaws.com/uploads/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750449558956.pdf",
          "fileSize": 67813,
          "status": "completed",
          "textractJobId": null,
          "csvS3Key": "processed/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750449558956.csv",
          "csvUrl": "https://s3-us-east-2.amazonaws.com/converseinsurance/processed/2025-06-20_carrier-66_commission_2025-06-20_nationwide_commissions_april_2025_1750449558956.csv",
          "jsonS3Key": null,
          "jsonUrl": null,
          "processingError": null,
          "metadata": {
            "completionData": {
              "message": "10 of 12 transactions completed. 2 had invalid policy numbers.",
              "carrierName": "Nationwide Insurance",
              "completedAt": "2025-06-20T20:00:36.965Z",
              "totalTransactions": 12,
              "failedTransactions": [
                {
                  "type": "policy_not_found",
                  "error": "No policy found for 7842HR25032kcdl",
                  "insuredName": null,
                  "statementId": "a06am00000CWMphAAH",
                  "originalData": {
                    "Policy Name": null,
                    "Policy Number": "7842HR25032kcdl",
                    "Name of Insured": null,
                    "Transaction Type": null,
                    "Transaction Amount": "9.28",
                    "Commission Statement": "a06am00000CWMphAAH"
                  },
                  "policyNumber": "7842HR25032kcdl",
                  "transactionAmount": "9.28",
                  "commissionStatementId": "a06am00000CWMphAAH"
                },
                {
                  "type": "policy_not_found",
                  "error": "No policy found for 7842HR25082lahjsf",
                  "insuredName": null,
                  "statementId": "a06am00000CWMphAAH",
                  "originalData": {
                    "Policy Name": null,
                    "Policy Number": "7842HR25082lahjsf",
                    "Name of Insured": null,
                    "Transaction Type": null,
                    "Transaction Amount": "0",
                    "Commission Statement": "a06am00000CWMphAAH"
                  },
                  "policyNumber": "7842HR25082lahjsf",
                  "transactionAmount": "0",
                  "commissionStatementId": "a06am00000CWMphAAH"
                }
              ],
              "numberOfSuccessful": 10
            }
          },
          "uploadedAt": "2025-06-20T19:59:19.820Z",
          "processedAt": "2025-06-20T19:59:52.371Z"
        }
      }
    ]
  }
]