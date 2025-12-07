const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    // "Bearer <token>" format
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // Find user (passwordHash hata ke)
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;
