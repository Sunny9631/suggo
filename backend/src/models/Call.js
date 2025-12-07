const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['ringing', 'connected', 'ended', 'missed', 'rejected'],
    default: 'ringing'
  },
  type: {
    type: String,
    enum: ['audio', 'video'],
    default: 'audio'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  roomId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Calculate duration when call ends
callSchema.pre('save', function(next) {
  if (this.isModified('endTime') && this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Call', callSchema);
