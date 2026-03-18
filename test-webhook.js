// Test Script for the Webhook Email Parsing
const fs = require('fs');

async function testWebhook() {
  console.log("Testing Webhook with a mock email body...");
  
  const mockPayload = {
    email_id: "test-email-12345",
    body_plain: "Dear Customer, Thank you for your payment. Your Transaction Receipt is below. Amount: RS 5,000. \n\nTransaction ID: TID-1773681124853\n\n Have a good day!"
  };

  try {
    const res = await fetch("http://localhost:3000/api/webhook/email-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockPayload)
    });
    
    const data = await res.json();
    console.log("Webhook Response:", data);
    
    if (data.success) {
      console.log("✅ Success! Checking database for updated status...");
      const checkRes = await fetch("http://localhost:3000/api/admissions");
      const checkData = await checkRes.json();
      console.log(checkData.data.map(d => ({id: d.id, tid: d.transaction_id, status: d.verification_status})));
    }
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

testWebhook();
