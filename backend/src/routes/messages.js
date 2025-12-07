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

router.put("/:messageId/seen", auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid messageId format" });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Verify user is in the conversation and is not the sender
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user._id
    });
    
    if (!conversation) {
      return res.status(403).json({ message: "Not authorized to mark this message as seen" });
    }

    if (message.senderId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot mark your own message as seen" });
    }

    // Mark message as seen
    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { 
        seen: true, 
        readAt: new Date() 
      },
      { new: true }
    ).populate('senderId', 'username displayName avatarUrl');

    // Note: Socket emission will be handled by the frontend through polling
    // or we can add this to the socket handler later

    res.json(updatedMessage);
  } catch (err) {
    console.error("Mark message seen error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:messageId", auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid messageId format" });
    }

    const message = await Message.findById(messageId)
      .populate('senderId', 'username displayName avatarUrl');
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Verify user is in the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: req.user._id
    });
    
    if (!conversation) {
      return res.status(403).json({ message: "Not authorized to view this message" });
    }

    res.json(message);
  } catch (err) {
    console.error("Get message error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;