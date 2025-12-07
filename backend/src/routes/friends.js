const express = require('express');
const router = express.Router();
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all friend requests for current user
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'username displayName avatarUrl');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all friends of current user
router.get('/', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user._id }, { user2: req.user._id }]
    }).populate('user1 user2', 'username displayName avatarUrl online');

    const friends = friendships.map(friendship => {
      const friend = friendship.user1._id.toString() === req.user._id.toString() 
        ? friendship.user2 
        : friendship.user1;
      return friend;
    });

    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send friend request
router.post('/request', auth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    
    if (receiverId === req.user._id) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    // Check if already friends
    const existingFriendship = await Friendship.findOne({
      $or: [
        { user1: req.user._id, user2: receiverId },
        { user1: receiverId, user2: req.user._id }
      ]
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Already friends" });
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ error: "Friend request already exists" });
    }

    const friendRequest = new FriendRequest({
      sender: req.user._id,
      receiver: receiverId
    });

    await friendRequest.save();
    
    // Populate sender info for response and socket event
    const populatedRequest = await FriendRequest.findById(friendRequest._id)
      .populate('sender', 'username displayName avatarUrl')
      .populate('receiver', 'username displayName avatarUrl');
    
    // Emit socket event to receiver
    const io = req.app.get('io');
    const receiverSocket = Array.from(io.sockets.sockets.values())
      .find(socket => socket.userId === receiverId);
    
    if (receiverSocket) {
      receiverSocket.emit('friend_request', populatedRequest);
    }

    res.status(201).json(populatedRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept friend request
router.post('/accept/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (!friendRequest.receiver.equals(req.user._id)) {
      return res.status(403).json({ error: "Not authorized to accept this request" });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: "Friend request already processed" });
    }

    // Update request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Create friendship
    const friendship = new Friendship({
      user1: friendRequest.sender,
      user2: friendRequest.receiver
    });

    await friendship.save();
    
    // Populate friendship data
    await friendship.populate('user1 user2', 'username displayName avatarUrl online');
    
    // Emit socket events
    const io = req.app.get('io');
    
    // Notify sender that request was accepted
    const senderSocket = Array.from(io.sockets.sockets.values())
      .find(socket => socket.userId === friendRequest.sender.toString());
    
    if (senderSocket) {
      const friendData = friendship.user1._id.toString() === friendRequest.sender.toString()
        ? friendship.user2
        : friendship.user1;
      
      senderSocket.emit('friend_request_accepted', friendData);
    }

    res.json({ message: "Friend request accepted", friendship });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject friend request
router.post('/reject/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (!friendRequest.receiver.equals(req.user._id)) {
      return res.status(403).json({ error: "Not authorized to reject this request" });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: "Friend request already processed" });
    }

    // Update request status
    friendRequest.status = 'rejected';
    await friendRequest.save();
    
    // Populate sender info for notification
    await friendRequest.populate('sender', 'username displayName avatarUrl');

    // Emit socket event to sender
    const io = req.app.get('io');
    const senderSocket = Array.from(io.sockets.sockets.values())
      .find(socket => socket.userId === friendRequest.sender.toString());
    
    if (senderSocket) {
      senderSocket.emit('friend_request_rejected', {
        receiver: await User.findById(req.user._id).select('username displayName avatarUrl')
      });
    }

    res.json({ message: "Friend request rejected" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove friend
router.delete('/remove/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    const friendship = await Friendship.findOneAndDelete({
      $or: [
        { user1: req.user._id, user2: friendId },
        { user1: friendId, user2: req.user._id }
      ]
    });

    if (!friendship) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    // Emit socket events
    const io = req.app.get('io');
    
    // Notify both users
    [req.user._id, friendId].forEach(userId => {
      const socket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === userId.toString());
      
      if (socket) {
        socket.emit('friend_removed', { friendId: userId === req.user._id ? friendId : req.user._id });
      }
    });

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
