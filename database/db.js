// =============================================================================
// database/db.js
// MongoDB connection using Mongoose (replacing SQLite/sql.js for Vercel)
// =============================================================================

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Error: ${err.message}`);
    // DO NOT process.exit(1) in a serverless function (Vercel)
    // Killing the process will return an HTML error page.
  }
};

// ── 1. User Schema ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  phone:     { type: String },
  createdAt: { type: Date,   default: Date.now }
});

const User = mongoose.model("User", userSchema);

// ── 2. Session Schema ───────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true },
  user_id:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date,   default: Date.now, expires: "7d" } // Auto-delete after 7 days
});

const Session = mongoose.model("Session", sessionSchema);

// ── 3. StudentAdmission Schema ──────────────────────────────────────────────
const admissionSchema = new mongoose.Schema({
  full_name:           { type: String, required: true },
  email:               { type: String, required: true },
  whatsapp_number:     { type: String, required: true },
  course_selected:     { type: String, required: true },
  transaction_id:      { type: String, required: true, unique: true },
  receipt_image_url:   { type: String, required: true },
  verification_status: { 
    type: String, 
    enum: ["Pending", "Verified", "Rejected"], 
    default: "Pending" 
  },
  submitted_at:        { type: Date,   default: Date.now },
  user_id:             { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

const StudentAdmission = mongoose.model("StudentAdmission", admissionSchema);

module.exports = { connectDB, User, Session, StudentAdmission };
