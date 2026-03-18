// =============================================================================
// routes/webhook.js
// Handles incoming Webhook POST requests (e.g., from Make.com or Google Apps Script)
// Parses the email body for Transaction IDs and updates verification status
// =============================================================================

const express = require("express");
const { getDB, saveDB } = require("../database/db");
const router  = express.Router();

router.post("/email-receipt", (req, res) => {
  try {
    // 1. Receive Payload (from Google Apps Script via Make)
    const payload = req.body;
    
    // Fallback: If payload is stringified, parse it
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    const emailBody = data.body_plain || "";
    if (!emailBody) {
      return res.status(400).json({ success: false, message: "No email body provided." });
    }

    // 2. Extract Transaction ID using Regex
    // This looks for "TID-" followed by digits OR standard 11-14 digit numbers
    const tidRegex = /(?:TID-)?(\d{11,15})/i;
    const match = emailBody.match(tidRegex);

    if (!match || !match[1]) {
      return res.status(400).json({ 
        success: false, 
        message: "No valid 11-15 digit Transaction ID found in the email body.",
        body_received: emailBody.substring(0, 100) + "..." // preview
      });
    }

    const transactionId = match[0]; // Gets TID-1234 or just 1234 depending on match
    const cleanTid = transactionId.replace("TID-", ""); // Let's try matching both the raw number or the prefixed one just in case

    // 3. Search Database for this TID
    const db = getDB();
    
    // We search the database for either the raw number, or the number with 'TID-' prefix
    const searchResult = db.exec(
      "SELECT id FROM StudentAdmissions WHERE transaction_id = ? OR transaction_id = ?", 
      [cleanTid, `TID-${cleanTid}`]
    );

    if (searchResult.length === 0 || searchResult[0].values.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transaction ID '${cleanTid}' found in email, but no matching student application was found in the database.`,
      });
    }

    const studentId = searchResult[0].values[0][0];

    // 4. Update the verification status to "Verified"
    db.run(
      "UPDATE StudentAdmissions SET verification_status = 'Verified' WHERE id = ?",
      [studentId]
    );

    // 5. Save the database atomically to disk
    saveDB();

    return res.status(200).json({
      success: true,
      message: `Successfully verified Transaction ID ${cleanTid} for Student ID ${studentId}`,
      student_id: studentId
    });

  } catch (error) {
    console.error("🔥 Error in Webhook /email-receipt:", error);
    return res.status(500).json({ success: false, message: "Internal Webhook Error" });
  }
});

module.exports = router;
