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