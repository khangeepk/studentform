// =============================================================================
// server.js  —  Entry point for the Student Admission Backend API
// =============================================================================
// Tech Stack:
//   • Node.js + Express  — HTTP server and routing
//   • MongoDB + Mongoose — Cloud Database
//   • Cloudinary         — Cloud Image Storage
//   • Multer             — File upload handling
//   • dotenv             — Environment variables
// =============================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const path     = require("path");

const { connectDB }      = require("./database/db");
const admissionsRouter   = require("./routes/admissions");
const { router: authRouter } = require("./routes/auth");
const webhookRouter      = require("./routes/webhook");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend HTML
app.use(express.static(path.join(__dirname)));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api", admissionsRouter);
app.use("/api/webhook", webhookRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "Online", timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Error:", err.message || err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File too large. Max 5 MB." });
  }
  return res.status(err.status || 500).json({ success: false, message: err.message || "Unexpected error." });
});

// ── Database Connection ───────────────────────────────────────────────────────
console.log("🚀 Starting Database connection process...");
if (!process.env.MONGODB_URI) {
  console.error("❌ ERROR: MONGODB_URI is not defined in environment variables!");
} else {
  const uri = process.env.MONGODB_URI.substring(0, 20) + "********";
  console.log(`📡 Using MongoDB URI: ${uri}`);
}

connectDB();

// ── Startup ──────────────────────────────────────────────────────────────────
// Only start listening if NOT running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║   🎓  Student Admission API  —  Online       ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║   🌐  Frontend : http://localhost:${PORT}         ║`);
    console.log(`║   📡  API Base : http://localhost:${PORT}/api     ║`);
    console.log("╚══════════════════════════════════════════════╝");
    console.log("");
  });
}

// Export the app for Vercel
module.exports = app;
