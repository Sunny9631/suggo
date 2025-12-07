const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

router.get("/me", auth, (req, res) => {
  res.json(req.user);
});

router.put("/me", auth, async (req, res) => {
  try {
    const { bio, displayName, avatarUrl } = req.body;
    
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

    const updateData = {
      bio: bio ? bio.trim() : "",
      displayName: displayName ? displayName.trim() : req.user.displayName,
      avatarUrl: avatarUrl ? avatarUrl.trim() : ""
    };

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

module.exports = router;