// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is not set in .env");
}

// helper: token banane ka function
function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, displayName, mobile } = req.body;

    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "username, email and password are required" });
    }

    // Username validation: 3-20 chars, alphanumeric and underscore only
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ message: "Username must be 3-20 characters and contain only letters, numbers, and underscores" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Mobile validation (optional)
    if (mobile && !/^\d{10,15}$/.test(mobile)) {
      return res.status(400).json({ message: "Mobile number must be 10-15 digits" });
    }

    // Password validation: minimum 6 characters
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Display name validation: max 50 characters
    if (displayName && displayName.length > 50) {
      return res.status(400).json({ message: "Display name must be less than 50 characters" });
    }

    const existing = await User.findOne({
      $or: [{ email }, { username }, ...(mobile ? [{ mobile }] : [])],
    });

    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      if (existing.username === username) {
        return res.status(400).json({ message: "User with this username already exists" });
      }
      if (mobile && existing.mobile === mobile) {
        return res.status(400).json({ message: "User with this mobile number already exists" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile ? mobile.trim() : undefined,
      passwordHash,
      displayName: displayName ? displayName.trim() : username,
    });

    const token = createToken(user._id);

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Internal server error (register)" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;

    if (!emailOrMobile || !password) {
      return res.status(400).json({ message: "email/mobile and password are required" });
    }

    // Input sanitization
    const sanitizedInput = emailOrMobile.trim();

    // Check if input is email or mobile number
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedInput);
    const isMobile = /^\d{10,15}$/.test(sanitizedInput);

    let query;
    if (isEmail) {
      query = { email: sanitizedInput.toLowerCase() };
    } else if (isMobile) {
      query = { mobile: sanitizedInput };
    } else {
      query = { username: sanitizedInput };
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = createToken(user._id);

    return res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error (login)" });
  }
});

module.exports = router;
