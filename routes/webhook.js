// =============================================================================
// routes/webhook.js
// Handles incoming Webhook POST requests (e.g., from Make.com or Google Apps Script)
// Parses the email body for Transaction IDs and updates verification status
// =============================================================================

const express = require("express");
const { StudentAdmission } = require("../database/db");
const router  = express.Router();

router.post("/email-receipt", async (req, res) => {
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

    const transactionId = match[1]; // Get the raw number
    const tidPrefixed = `TID-${transactionId}`;

    // 3. Search Database for this TID (MongoDB)
    const admission = await StudentAdmission.findOne({
      $or: [
        { transaction_id: transactionId },
        { transaction_id: tidPrefixed }
      ]
    });

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: `Transaction ID '${transactionId}' found in email, but no matching student application was found in the database.`,
      });
    }

    // 4. Update the verification status to "Verified"
    admission.verification_status = 'Verified';
    await admission.save();

    return res.status(200).json({
      success: true,
      message: `Successfully verified Transaction ID ${transactionId} for student ${admission.full_name}`,
      student_id: admission._id
    });

  } catch (error) {
    console.error("🔥 Error in Webhook /email-receipt:", error);
    return res.status(500).json({ success: false, message: "Internal Webhook Error", error: error.message });
  }
});

module.exports = router;
