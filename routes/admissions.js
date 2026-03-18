// =============================================================================
// routes/admissions.js
// Route handlers for Student Admission using Cloudinary and MongoDB
// =============================================================================

const express = require("express");
const multer  = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { v4: uuidv4 } = require("uuid");
const { StudentAdmission, Session } = require("../database/db");
const { getCookies } = require("./auth");
const router  = express.Router();

// ── 1. CLOUDINARY CONFIG ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// =============================================================================
// GET /api/upload-signature
// Generates a secure signature for direct frontend upload to Cloudinary
// =============================================================================
router.get("/upload-signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "student_receipts";
    
    // Cloudinary expects comma-separated string for signing allowed_formats
    const allowed_formats = "jpg,png,webp,pdf";

    const params_to_sign = {
      timestamp: timestamp,
      folder: folder,
      allowed_formats: allowed_formats
    };

    const signature = cloudinary.utils.api_sign_request(
      params_to_sign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder: folder,
      allowed_formats: allowed_formats
    });
  } catch (error) {
    console.error("❌ Error generating signature:", error);
    res.status(500).json({ success: false, message: "Failed to generate upload signature." });
  }
});

// =============================================================================
// POST /api/submit-admission
// =============================================================================
router.post(
  "/submit-admission",
  async (req, res) => {
    try {
      // ── 1. Validate text fields ──────────────────────────────────────────
      const { full_name, email, whatsapp_number, program_selected, transaction_id } = req.body;
      const course_selected = program_selected; // Map frontend → DB

      const missingFields = [];
      if (!full_name)       missingFields.push("full_name");
      if (!email)           missingFields.push("email");
      if (!whatsapp_number) missingFields.push("whatsapp_number");
      if (!course_selected) missingFields.push("program_selected");
      if (!transaction_id)  missingFields.push("transaction_id");

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields.",
          missing: missingFields,
        });
      }

      // ── 2. Validate file upload ──────────────────────────────────────────
      const { receipt_url } = req.body;
      if (!receipt_url) {
        return res.status(400).json({
          success: false,
          message: "Payment receipt image URL is required.",
        });
      }

      // ── 3. Check for duplicate TID ───────────────────────────────────────
      const existing = await StudentAdmission.findOne({ transaction_id: transaction_id.trim() });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This Transaction ID (TID) has already been submitted. Please check your receipt and try again.",
        });
      }

      // ── 4. Check authentication & associate user_id ───────────────────
      const cookies = getCookies(req);
      const token = cookies.session_token;
      let userId = null;
      if (token) {
        const session = await Session.findOne({ token });
        if (session) userId = session.user_id;
      }

      // ── 5. Create new record in MongoDB ─────────────────────────────────
      const admission = await StudentAdmission.create({
        full_name:           full_name.trim(),
        email:               email.trim().toLowerCase(),
        whatsapp_number:     whatsapp_number.trim(),
        course_selected:     course_selected.trim(),
        transaction_id:      transaction_id.trim(),
        receipt_image_url:   receipt_url, // URL from direct Cloudinary upload
        user_id:             userId,
        verification_status: "Verified"
      });

      return res.status(201).json({
        success:       true,
        message:       "Application submitted successfully! It is under review.",
        admission_id:  admission._id,
        receipt_url:   admission.receipt_image_url,
      });

    } catch (error) {
      console.error("❌ Error in POST /submit-admission:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error. Please try again later.",
      });
    }
  }
);

// =============================================================================
// GET /api/my-admissions
// =============================================================================
router.get("/my-admissions", async (req, res) => {
  try {
    const cookies = getCookies(req);
    const token = cookies.session_token;
    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const session = await Session.findOne({ token });
    if (!session) return res.status(401).json({ success: false, message: "Invalid session" });

    const data = await StudentAdmission.find({ user_id: session.user_id }).sort({ submitted_at: -1 });

    return res.status(200).json({ 
      success: true, 
      count: data.length, 
      data: data.map(d => ({ ...d.toObject(), id: d._id })) 
    });
  } catch (error) {
    console.error("❌ Error in GET /my-admissions:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve your admissions." });
  }
});

// =============================================================================
// GET /api/admissions (Admin view)
// =============================================================================
router.get("/admissions", async (req, res) => {
  try {
    const data = await StudentAdmission.find().sort({ submitted_at: -1 });

    return res.status(200).json({
      success: true,
      count:   data.length,
      data:    data.map(d => ({ ...d.toObject(), id: d._id })),
    });
  } catch (error) {
    console.error("❌ Error in GET /admissions:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve admissions." });
  }
});

// =============================================================================
// GET /api/admissions/:id
// =============================================================================
router.get("/admissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admission = await StudentAdmission.findById(id);

    if (!admission) {
      return res.status(404).json({ success: false, message: "Admission record not found." });
    }

    return res.status(200).json({ 
      success: true, 
      data: { ...admission.toObject(), id: admission._id } 
    });
  } catch (error) {
    console.error("❌ Error in GET /admissions/:id:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve admission record." });
  }
});

// =============================================================================
// GET /api/admissions/status/:tid
// =============================================================================
router.get("/admissions/status/:tid", async (req, res) => {
  try {
    const { tid } = req.params;
    const cleanTid = tid.replace('TID-', '');
    
    // Check for both exact TID and prefixed TID
    const admission = await StudentAdmission.findOne({
      $or: [
        { transaction_id: tid },
        { transaction_id: `TID-${cleanTid}` }
      ]
    });

    if (!admission) {
      return res.status(404).json({ success: false, message: "No application found with this Transaction ID." });
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        full_name: admission.full_name,
        transaction_id: admission.transaction_id,
        verification_status: admission.verification_status,
        submitted_at: admission.submitted_at
      }
    });

  } catch (error) {
    console.error("❌ Error in GET /admissions/status/:tid:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve admission status." });
  }
});

// =============================================================================
// PATCH /api/admissions/:id/verify
// =============================================================================
router.patch("/admissions/:id/verify", async (req, res) => {
  try {
    const { id } = req.params;
    const admission = await StudentAdmission.findByIdAndUpdate(
      id, 
      { verification_status: 'Verified' },
      { new: true }
    );

    if (!admission) {
      return res.status(404).json({ success: false, message: "Admission record not found." });
    }

    return res.status(200).json({ success: true, message: "Admission successfully verified." });
  } catch (error) {
    console.error("❌ Error in PATCH /admissions/:id/verify:", error);
    return res.status(500).json({ success: false, message: "Failed to verify admission record." });
  }
});

module.exports = router;
