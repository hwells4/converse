// Test the actual webhook payload that n8n is sending
const payload = [
  {
    "totalProcessed": 2,
    "successCount": 1,
    "failureCount": 1,
    "results": {
      "successful": [
        {
          "success": true,
          "message": "Transaction created successfully",
          "transaction": {
            "id": "a05am000009MKKgAAO",
            "statementId": "a06am00000CWNLxAAP",
            "policyNumber": "7842HR250328",
            "amount": "9.28",
            "policyId": "006am000008JoxXAAS"
          }
        }
      ],
      "failed": [
        {
          "success": false,
          "message": "Policy not found",
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
    "summary": "Processed 2 transactions: 1 successful, 1 failed"
  }
];

console.log('Testing the final webhook payload that n8n is sending...');
console.log('Looking for statementId:', payload[0].results.successful[0].transaction.statementId);

fetch('https://prdparser-6cbh.replit.app/api/webhook/n8n-correction-completion', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload)
})
.then(async response => {
  const text = await response.text();
  console.log('\n=== WEBHOOK RESPONSE ===');
  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('Response Body:', text);
  
  if (response.status === 200) {
    console.log('✅ Webhook call successful!');
    console.log('✅ Database should be updated now');
  } else {
    console.log('❌ Webhook call failed - this is why frontend is not updating');
  }
})
.catch(error => {
  console.error('❌ Network error calling webhook:', error);
});