const express = require('express');
const auth = require('../middleware/auth');
const Call = require('../models/Call');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// Initiate a call
router.post('/initiate', auth, async (req, res) => {
  try {
    const { receiverId, type = 'audio' } = req.body;
    const currentUserId = req.user._id.toString();
    
    console.log('Call initiate request:', { receiverId, type, currentUserId });
    
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      console.log('Invalid receiver ID format:', receiverId);
      return res.status(400).json({ message: 'Invalid receiver ID' });
    }

    if (receiverId === currentUserId) {
      console.log('User trying to call themselves:', receiverId, currentUserId);
      return res.status(400).json({ message: 'Cannot call yourself' });
    }

    // Check if receiver is online
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check for existing active call - TEMPORARILY DISABLED FOR TESTING
    console.log('TEMPORARILY SKIPPING existing call check');
    const existingCall = null; // await Call.findOne({
    //   $or: [
    //     { callerId: req.user._id, receiverId, status: { $in: ['ringing', 'connected'] } },
    //     { callerId: receiverId, receiverId: req.user._id, status: { $in: ['ringing', 'connected'] } }
    //   ]
    // });
    // console.log('Found existing call:', existingCall);

    if (existingCall) {
      return res.status(400).json({ message: 'Call already in progress' });
    }

    // Generate unique room ID
    const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const call = await Call.create({
      callerId: req.user._id,
      receiverId,
      type,
      roomId
    });

    // Populate caller info
    await call.populate('callerId', 'username displayName avatarUrl');

    res.status(201).json(call);
  } catch (err) {
    console.error('Initiate call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Answer a call
router.post('/:callId/answer', auth, async (req, res) => {
  try {
    const { callId } = req.params;
    const currentUserId = req.user._id;
    
    console.log('Answer call request:', { callId, currentUserId });
    
    if (!mongoose.Types.ObjectId.isValid(callId)) {
      console.log('Invalid call ID format:', callId);
      return res.status(400).json({ message: 'Invalid call ID' });
    }

    const call = await Call.findById(callId);
    if (!call) {
      console.log('Call not found:', callId);
      return res.status(404).json({ message: 'Call not found' });
    }

    console.log('Call found:', {
      callId: call._id,
      status: call.status,
      callerId: call.callerId,
      receiverId: call.receiverId,
      receiverIdType: typeof call.receiverId,
      callerIdType: typeof call.callerId
    });

    // Verify user is the receiver
    const receiverIdStr = call.receiverId.toString();
    const currentUserIdStr = currentUserId.toString();
    
    console.log('Comparing IDs:', { receiverIdStr, currentUserIdStr });
    
    if (receiverIdStr !== currentUserIdStr) {
      console.log('User not authorized to answer this call');
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (call.status !== 'ringing') {
      console.log('Call status not ringing:', call.status);
      return res.status(400).json({ message: 'Call is no longer ringing' });
    }

    call.status = 'connected';
    call.startTime = new Date();
    await call.save();

    await call.populate('callerId', 'username displayName avatarUrl');

    console.log('Call answered successfully');
    res.json(call);
  } catch (err) {
    console.error('Answer call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject a call
router.post('/:callId/reject', auth, async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ message: 'Invalid call ID' });
    }

    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Verify user is the receiver
    if (call.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    call.status = 'rejected';
    call.endTime = new Date();
    await call.save();

    res.json(call);
  } catch (err) {
    console.error('Reject call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// End a call
router.post('/:callId/end', auth, async (req, res) => {
  try {
    const { callId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(callId)) {
      return res.status(400).json({ message: 'Invalid call ID' });
    }

    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Verify user is either caller or receiver
    if (call.callerId.toString() !== req.user._id.toString() && 
        call.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    call.status = 'ended';
    call.endTime = new Date();
    await call.save();

    await call.populate([
      { path: 'callerId', select: 'username displayName avatarUrl' },
      { path: 'receiverId', select: 'username displayName avatarUrl' }
    ]);

    res.json(call);
  } catch (err) {
    console.error('End call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get call history
router.get('/history', auth, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [
        { callerId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
    .populate([
      { path: 'callerId', select: 'username displayName avatarUrl' },
      { path: 'receiverId', select: 'username displayName avatarUrl' }
    ])
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(calls);
  } catch (err) {
    console.error('Get call history error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active call
router.get('/active', auth, async (req, res) => {
  try {
    const activeCall = await Call.findOne({
      $or: [
        { callerId: req.user._id, status: { $in: ['ringing', 'connected'] } },
        { receiverId: req.user._id, status: { $in: ['ringing', 'connected'] } }
      ]
    })
    .populate([
      { path: 'callerId', select: 'username displayName avatarUrl' },
      { path: 'receiverId', select: 'username displayName avatarUrl' }
    ]);

    if (!activeCall) {
      return res.json(null);
    }

    res.json(activeCall);
  } catch (err) {
    console.error('Get active call error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
