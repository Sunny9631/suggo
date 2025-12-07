const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure no duplicate friendships (regardless of order)
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

// Create compound index for efficient lookups
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });
friendshipSchema.index({ user2: 1, user1: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
