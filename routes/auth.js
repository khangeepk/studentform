// =============================================================================
// routes/auth.js
// Handles user authentication: Register, Login, Logout, Profile Details
// Uses Mongoose models for MongoDB Atlas
// =============================================================================

const express = require("express");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { User, Session } = require("../database/db");
const router = express.Router();

// Helper to hash passwords securely using PBKDF2
function hashPassword(password) {
  const salt = "EDU_PORTAL_SALT_2026"; // In prod, generate a unique salt per user
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Helper to parse cookies from req.headers.cookie
function getCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(`;`).forEach(cookie => {
    let [name, ...rest] = cookie.split(`=`);
    name = name?.trim();
    if (!name) return;
    const value = rest.join(`=`).trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// =============================================================================
// POST /api/auth/register
// =============================================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    const emailClean = email.trim().toLowerCase();
    
    // Check if email already exists
    const existing = await User.findOne({ email: emailClean });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already exists. Please login." });
    }

    const hashedPassword = hashPassword(password);

    await User.create({
      name: name.trim(),
      email: emailClean,
      password: hashedPassword,
      phone: (phone || "").trim()
    });

    return res.status(201).json({ success: true, message: "Registration successful. You can now login." });
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error during registration." });
  }
});

// =============================================================================
// POST /api/auth/login
// =============================================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const emailClean = email.trim().toLowerCase();
    const hashedPassword = hashPassword(password);

    const user = await User.findOne({ email: emailClean, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Generate session token
    const token = uuidv4();
    
    // Create new session in DB
    await Session.create({ token, user_id: user._id });

    // Set HTTP-Only cookie for future requests
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({ success: true, message: "Login successful!" });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error during login." });
  }
});

// =============================================================================
// POST /api/auth/logout
// =============================================================================
router.post("/logout", async (req, res) => {
  try {
    const cookies = getCookies(req);
    const token = cookies.session_token;

    if (token) {
      await Session.deleteOne({ token });
    }

    res.clearCookie('session_token');
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({ success: false, message: "Failed to logout." });
  }
});

// =============================================================================
// GET /api/auth/me (Get Current Logged in User)
// =============================================================================
router.get("/me", async (req, res) => {
  try {
    const cookies = getCookies(req);
    const token = cookies.session_token;

    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const session = await Session.findOne({ token }).populate("user_id");

    if (!session || !session.user_id) {
      res.clearCookie('session_token');
      return res.status(401).json({ success: false, message: "Session expired or invalid" });
    }

    const { _id, name, email, phone } = session.user_id;
    const user = { id: _id, name, email, phone };

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("Me Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error checking session." });
  }
});

// =============================================================================
// PATCH /api/auth/update-profile
// =============================================================================
router.patch("/update-profile", async (req, res) => {
  try {
    const cookies = getCookies(req);
    const token = cookies.session_token;
    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }
    const userId = session.user_id;

    const { name, phone, newPassword } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = (phone || "").trim();
    if (newPassword && newPassword.trim().length >= 6) {
      updateData.password = hashPassword(newPassword);
    }

    if (Object.keys(updateData).length > 0) {
      await User.findByIdAndUpdate(userId, updateData);
    }

    return res.status(200).json({ success: true, message: "Profile updated successfully." });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
});

module.exports = {
  router,
  getCookies
};
