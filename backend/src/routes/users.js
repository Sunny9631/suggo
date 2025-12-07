const express = require("express");
const auth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

router.get("/me", auth, (req, res) => {
  res.json(req.user);
});

router.put("/me", auth, async (req, res) => {
  try {
    const { bio, displayName, avatarUrl, email, mobile, currentPassword, newPassword } = req.body;
    
    // Validate displayName
    if (displayName && displayName.length > 50) {
      return res.status(400).json({ message: "Display name must be less than 50 characters" });
    }
    
    // Validate bio
    if (bio && bio.length > 200) {
      return res.status(400).json({ message: "Bio must be less than 200 characters" });
    }
    
    // Validate avatarUrl format if provided
    if (avatarUrl && !avatarUrl.match(/^https?:\/\/.+/)) {
      return res.status(400).json({ message: "Invalid avatar URL format" });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      // Check if email is already taken by another user
      const existingEmail = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: req.user._id } 
      });
      if (existingEmail) {
        return res.status(400).json({ message: "Email is already taken" });
      }
    }

    // Validate mobile if provided
    if (mobile) {
      if (!/^\d{10,15}$/.test(mobile)) {
        return res.status(400).json({ message: "Mobile number must be 10-15 digits" });
      }
      
      // Check if mobile is already taken by another user
      const existingMobile = await User.findOne({ 
        mobile, 
        _id: { $ne: req.user._id } 
      });
      if (existingMobile) {
        return res.status(400).json({ message: "Mobile number is already taken" });
      }
    }

    // Validate password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change password" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, req.user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
    }

    const updateData = {
      bio: bio ? bio.trim() : req.user.bio,
      displayName: displayName ? displayName.trim() : req.user.displayName,
      avatarUrl: avatarUrl ? avatarUrl.trim() : req.user.avatarUrl,
    };

    // Add email if provided
    if (email) {
      updateData.email = email.toLowerCase().trim();
    }

    // Add mobile if provided
    if (mobile) {
      updateData.mobile = mobile.trim();
    }

    // Add new password if provided
    if (newPassword) {
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select("-passwordHash");
    
    res.json(user);
  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search", auth, async (req, res) => {
  try {
    const q = req.query.q || "";
    
    // Validate search query
    if (q.length < 2) {
      return res.status(400).json({ message: "Search query must be at least 2 characters" });
    }
    
    if (q.length > 50) {
      return res.status(400).json({ message: "Search query is too long" });
    }

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { username: new RegExp(q.trim(), "i") },
        { displayName: new RegExp(q.trim(), "i") }
      ]
    })
      .limit(20)
      .select("username displayName avatarUrl");
      
    res.json(users);
  } catch (err) {
    console.error("Search users error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select("username displayName bio avatarUrl online lastSeenAt createdAt");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (err) {
    console.error("Get user profile error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;