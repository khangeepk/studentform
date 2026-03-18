const { initDB, getDB, saveDB } = require('./database/db');

initDB().then(() => {
  const db = getDB();

  db.run(
    "UPDATE StudentAdmissions SET verification_status = 'Verified' WHERE verification_status = 'Pending' AND receipt_image_url IS NOT NULL AND receipt_image_url != ''"
  );

  const result = db.exec("SELECT COUNT(*) as cnt FROM StudentAdmissions WHERE verification_status = 'Verified'");
  const verifiedCount = result[0]?.values[0][0] ?? 0;
  console.log('✅ Total Verified records now:', verifiedCount);
  saveDB();
  console.log('✅ Database saved. All pending-with-receipt records set to Verified!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
