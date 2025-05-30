import https from 'https';

const testData = JSON.stringify({
  test: "simple ping"
});

const options = {
  hostname: 'db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev',
  port: 443,
  path: '/api/webhook/n8n-completion',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🔍 Testing webhook endpoint...');
console.log('URL:', `https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📨 Response:', data);
    
    if (res.statusCode === 200 || res.statusCode === 400) {
      console.log('✅ Endpoint is responding');
    } else {
      console.log('❌ Endpoint not working properly');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.write(testData);
req.end(); 