const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: "" },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);