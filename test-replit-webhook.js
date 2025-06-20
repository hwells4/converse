const payload = [
  {
    "totalProcessed": 1,
    "successCount": 0,
    "failureCount": 1,
    "results": {
      "successful": [],
      "failed": [
        {
          "success": false,
          "message": "Policy not found",
          "transaction": {
            "id": "a05am000009MJZtAAO",
            "statementId": "a06am00000CWNLxAAP",
            "policyNumber": "7842HR250328",
            "amount": "9.28",
            "policyId": "006am000008JoxXAAS"
          },
          "error": "No policy found for 7842HR25082kdas",
          "originalData": {
            "statementId": "a06am00000CWNLxAAP",
            "policyNumber": "7842HR25082kdas",
            "insuredName": null,
            "transactionAmount": "0"
          }
        }
      ]
    },
    "summary": "Processed 1 transactions: 0 successful, 1 failed"
  }
];

console.log('Testing webhook payload:', JSON.stringify(payload, null, 2));

fetch('https://prdparser-6cbh.replit.app/api/webhook/n8n-correction-completion', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload)
})
.then(response => {
  console.log('Status:', response.status);
  console.log('Headers:', [...response.headers.entries()]);
  return response.text();
})
.then(data => {
  console.log('Response:', data);
})
.catch(error => {
  console.error('Error:', error);
});