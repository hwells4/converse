import https from 'https';

// Test payload matching the structure you provided
const testPayload = [
  {
    "success": true,
    "message": "Document status updated to completed",
    "document": {
      "id": 33,
      "filename": "2025-05-30_allstate_statement_from_the_rogue_vc",
      "originalName": "Allstate Statement from The Rogue VC.pdf",
      "documentType": "commission",
      "carrierId": 63,
      "s3Key": "uploads/2025-05-30_carrier-63_commission_2025-05-30_allstate_statement_from_the_rogue_vc_1748587910629.pdf",
      "s3Url": "https://converseinsurance.s3.us-east-2.amazonaws.com/uploads/2025-05-30_carrier-63_commission_2025-05-30_allstate_statement_from_the_rogue_vc_1748587910629.pdf",
      "fileSize": 171539,
      "status": "completed",
      "textractJobId": null,
      "csvS3Key": "processed/2025-05-30_carrier-63_commission_2025-05-30_allstate_statement_from_the_rogue_vc_1748587910629.csv",
      "csvUrl": "https://s3-us-east-2.amazonaws.com/converseinsurance/processed/2025-05-30_carrier-63_commission_2025-05-30_allstate_statement_from_the_rogue_vc_1748587910629.csv",
      "jsonS3Key": null,
      "jsonUrl": null,
      "processingError": null,
      "metadata": {
        "completionData": {
          "message": "Your Allstate Insurance statement and 27 transactions completed successfully",
          "carrierName": "Allstate Insurance",
          "completedAt": "2025-05-30T07:27:25.971Z",
          "totalTransactions": 27,
          "failedTransactions": [],
          "numberOfSuccessful": 27
        }
      },
      "uploadedAt": "2025-05-30T06:51:51.068Z",
      "processedAt": "2025-05-30T06:52:23.438Z"
    }
  }
];

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev',
  port: 443,
  path: '/api/webhook/n8n-completion',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing N8N completion webhook...');
console.log('📋 Payload:', JSON.stringify(testPayload, null, 2));

const req = https.request(options, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  console.log(`📄 Headers:`, res.headers);
  
  res.setEncoding('utf8');
  let responseBody = '';
  
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log(`📥 Response: ${responseBody}`);
    try {
      const parsedResponse = JSON.parse(responseBody);
      console.log(`📊 Parsed Response:`, JSON.stringify(parsedResponse, null, 2));
    } catch (e) {
      console.log('⚠️ Response is not valid JSON');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
});

req.write(postData);
req.end(); 