const express = require("express");
const auth = require("../middleware/auth");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User"); // Add User model
const mongoose = require("mongoose"); // Add mongoose

const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ message: "participantId is required" });
    }

    // Validate participantId format
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      return res.status(400).json({ message: "Invalid participantId format" });
    }

    // Prevent self-conversation
    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot create conversation with yourself" });
    }

    // Check if participant exists
    const participantExists = await User.findById(participantId);
    if (!participantExists) {
      return res.status(404).json({ message: "User not found" });
    }

    let convo = await Conversation.findOne({
      participants: { $all: [req.user._id, participantId], $size: 2 }
    }).populate("participants", "username displayName avatarUrl online lastSeenAt");

    if (!convo) {
      convo = await Conversation.create({
        participants: [req.user._id, participantId]
      });
      // Populate the newly created conversation
      await convo.populate("participants", "username displayName avatarUrl online lastSeenAt");
    }

    res.status(201).json(convo);
  } catch (err) {
    console.error("Create conversation error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "username displayName avatarUrl online lastSeenAt");

    res.json(conversations);
  } catch (err) {
    console.error("Get conversations error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/messages", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;
    const cursor = req.query.cursor;

    // Validate conversation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid conversation ID format" });
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ message: "Limit must be between 1 and 100" });
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const query = { conversationId: id };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (isNaN(cursorDate.getTime())) {
        return res.status(400).json({ message: "Invalid cursor format" });
      }
      query.createdAt = { $lt: cursorDate };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("senderId", "username displayName avatarUrl");

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    res.json({
      messages: items.reverse(),
      nextCursor
    });
  } catch (err) {
    console.error("Get messages error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;