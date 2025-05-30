// Test with Railway webhook format
const testRailwayWebhook = async () => {
  try {
    const response = await fetch('https://db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev/api/pdf-parse-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'success',
        csv_url: 'https://s3-us-east-2.amazonaws.com/converseinsurance/processed/test.csv',
        original_filename: 'Nationwide Commissions April 2025.pdf'
      })
    });
    
    const data = await response.json();
    console.log('Railway webhook test response:', data);
  } catch (error) {
    console.error('Railway webhook test error:', error);
  }
};

testRailwayWebhook();