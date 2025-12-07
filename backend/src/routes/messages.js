const express = require("express");
const auth = require("../middleware/auth");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const mongoose = require("mongoose");

const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const { conversationId, text, attachments } = req.body;
    
    // Input validation
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId format" });
    }
    
    if ((!text || text.trim() === "") && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: "Message must contain text or attachments" });
    }

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Text length validation
    if (text && text.length > 2000) {
      return res.status(400).json({ message: "Message text is too long (max 2000 characters)" });
    }

    const message = await Message.create({
      conversationId,
      senderId: req.user._id,
      text: text ? text.trim() : "",
      attachments: attachments || []
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: message.createdAt
    });

    res.status(201).json(message);
  } catch (err) {
    console.error("Create message error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;