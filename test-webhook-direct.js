import https from 'https';

const postData = JSON.stringify({
  "status": "success",
  "csv_url": "https://s3-us-east-2.amazonaws.com/converseinsurance/processed/2025-05-30_carrier-6_commission_2025-05-29_safeco_2_1748572801177.csv",
  "original_filename": "uploads/2025-05-30_carrier-6_commission_2025-05-29_safeco_2_1748572801177.pdf"
});

const options = {
  hostname: 'db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev',
  port: 443,
  path: '/api/pdf-parse-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`Response body: ${chunk}`);
  });
  
  res.on('end', () => {
    console.log('Response ended');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();