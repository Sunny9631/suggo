require("dotenv").config();
console.log("MONGO_URI:", process.env.MONGO_URI ? "Set" : "Not set");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const connectDB = require("./src/config/db");
const User = require("./src/models/User");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const convoRoutes = require("./src/routes/conversations");
const messageRoutes = require("./src/routes/messages");
const uploadRoutes = require("./src/routes/uploads");
const friendRoutes = require("./src/routes/friends");
const callRoutes = require("./src/routes/calls");
const Message = require("./src/models/Message");

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

connectDB();

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100
  })
);

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", convoRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/calls", callRoutes);

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);

  // Join user to their own room for direct messages
  socket.join(userId);

  await User.findByIdAndUpdate(userId, {
    online: true,
    lastSeenAt: new Date()
  });

  io.emit("presence_update", { userId, online: true });

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on("typing", ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit("typing", { userId, isTyping });
  });

  socket.on("send_message", async (payload, callback) => {
    try {
      const { conversationId, text, attachments } = payload;

      const message = await Message.create({
        conversationId,
        senderId: userId,
        text: text || "",
        attachments: attachments || []
      });

      // Send to everyone in the room except the sender
      socket.to(conversationId).emit("new_message", {
        ...message.toObject(),
        senderId: userId
      });

      if (callback) callback({ ok: true, messageId: message._id });
    } catch (err) {
      console.error("send_message error:", err.message);
      if (callback) callback({ ok: false });
    }
  });

  // Call signaling events
  socket.on("call_user", async (data) => {
    try {
      const { receiverId, callData } = data;
      
      // Notify receiver about incoming call
      io.to(receiverId).emit("incoming_call", {
        ...callData,
        callerId: userId
      });
      
      console.log(`Call initiated from ${userId} to ${receiverId}`);
    } catch (err) {
      console.error("call_user error:", err.message);
    }
  });

  socket.on("answer_call", async (data) => {
    try {
      const { callId, roomId } = data;
      
      // Notify caller that call was answered
      io.to(data.callerId).emit("call_answered", {
        callId,
        roomId,
        receiverId: userId
      });
      
      console.log(`Call ${callId} answered by ${userId}`);
    } catch (err) {
      console.error("answer_call error:", err.message);
    }
  });

  socket.on("reject_call", async (data) => {
    try {
      const { callId } = data;
      
      // Notify caller that call was rejected
      io.to(data.callerId).emit("call_rejected", {
        callId,
        receiverId: userId
      });
      
      console.log(`Call ${callId} rejected by ${userId}`);
    } catch (err) {
      console.error("reject_call error:", err.message);
    }
  });

  socket.on("end_call", async (data) => {
    try {
      const { callId, receiverId } = data;
      
      console.log(`end_call received from ${userId} for call ${callId}, notifying ${receiverId}`);
      
      // Notify other user that call ended
      if (receiverId) {
        io.to(receiverId).emit("call_ended", {
          callId,
          endedBy: userId
        });
        console.log(`call_ended event sent to ${receiverId}`);
      } else {
        console.log(`No receiverId provided for call ${callId}`);
      }
      
      console.log(`Call ${callId} ended by ${userId}`);
    } catch (err) {
      console.error("end_call error:", err.message);
    }
  });

  socket.on("join_call_room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${userId} joined call room ${roomId}`);
  });

  socket.on("leave_call_room", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${userId} left call room ${roomId}`);
  });

  // WebRTC signaling
  socket.on("webrtc_offer", (data) => {
    socket.to(data.targetUserId).emit("webrtc_offer", {
      offer: data.offer,
      callerId: userId
    });
  });

  socket.on("webrtc_answer", (data) => {
    socket.to(data.targetUserId).emit("webrtc_answer", {
      answer: data.answer,
      receiverId: userId
    });
  });

  socket.on("webrtc_ice_candidate", (data) => {
    socket.to(data.targetUserId).emit("webrtc_ice_candidate", {
      candidate: data.candidate,
      senderId: userId
    });
  });

  socket.on("disconnect", async () => {
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, {
      online: false,
      lastSeenAt: new Date()
    });
    io.emit("presence_update", { userId, online: false });
  });
});

// Friend request socket events (outside the connection handler)
io.on("connection", (socket) => {
  // These events are handled by the API routes, which emit socket events
  // The socket events are already handled in the friends routes
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});