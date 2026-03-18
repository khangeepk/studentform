const fs = require("fs");
const path = require("path");

async function runTest() {
  const dummyFilePath = path.join(__dirname, "dummy.jpg");
  fs.writeFileSync(dummyFilePath, "dummy image content");
  
  let fetchReady = false;
  try {
     new Blob();
     new FormData();
     fetchReady = true;
  } catch (err) {}

  if (!fetchReady) {
    console.log("fetch/FormData not available globally in this Node environment. Skipping full HTTP tests.");
    fs.unlinkSync(dummyFilePath);
    process.exit(0);
  }

  const formData = new FormData();
  formData.append('full_name', 'Ali Khan');
  formData.append('email', 'ali@example.com');
  formData.append('whatsapp_number', '03001234567');
  formData.append('program_selected', 'Computer Science');
  
  const tid = 'TID-' + Date.now();
  formData.append('transaction_id', tid);
  
  const fileBlob = new Blob([fs.readFileSync(dummyFilePath)], { type: 'image/jpeg' });
  formData.append('receipt', fileBlob, 'dummy.jpg');

  console.log("1. Submitting new admission form...");
  
  try {
    const res = await fetch("http://localhost:3000/api/submit-admission", {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("Result:", data);
    
    console.log("\n2. Submitting duplicate TID...");
    const formDataDup = new FormData();
    formDataDup.append('full_name', 'Ali Dup');
    formDataDup.append('email', 'alidup@example.com');
    formDataDup.append('whatsapp_number', '03001234567');
    formDataDup.append('program_selected', 'Computer Science');
    formDataDup.append('transaction_id', tid);
    formDataDup.append('receipt', fileBlob, 'dummy.jpg');
    
    const resDup = await fetch("http://localhost:3000/api/submit-admission", {
      method: "POST",
      body: formDataDup
    });
    const dataDup = await resDup.json();
    console.log("Result:", dataDup);

    console.log("\n3. Testing GET /api/admissions");
    const resGet = await fetch("http://localhost:3000/api/admissions");
    const dataGet = await resGet.json();
    console.log(`Found ${dataGet.count} records.`);
    
    if(dataGet.count > 0) {
      const record = dataGet.data[0];
      const resSingle = await fetch(`http://localhost:3000/api/admissions/${record.id}`);
      const dataSingle = await resSingle.json();
      console.log(`4. Testing GET /api/admissions/${record.id} -> Success:`, dataSingle.success);
      if (dataSingle.success) {
        console.log("Verification Status:", dataSingle.data.verification_status);
      }
    }
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    if (fs.existsSync(dummyFilePath)) {
      fs.unlinkSync(dummyFilePath);
    }
  }
}

runTest();
