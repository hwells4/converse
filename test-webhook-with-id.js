import https from 'https';

const postData = JSON.stringify({
  "status": "success",
  "csv_url": "https://s3-us-east-2.amazonaws.com/converseinsurance/processed/2025-05-30_carrier-6_commission_2025-05-29_nationwide_commissions_april_2025_1748573397826.csv",
  "original_filename": "uploads/2025-05-30_carrier-6_commission_2025-05-29_nationwide_commissions_april_2025_1748573397826.pdf"
});

const options = {
  hostname: 'db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev',
  port: 443,
  path: '/api/pdf-parse-webhook?document_id=26',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(postData);
req.end();