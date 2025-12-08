const mongoose = require('mongoose');
const Call = require('./src/models/Call');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat')
  .then(async () => {
    console.log('Connected to MongoDB');
    const calls = await Call.find({
      status: { $in: ['ringing', 'connected', 'initiated'] }
    }).populate('callerId receiverId');
    console.log('Active calls:', JSON.stringify(calls, null, 2));
    
    // Clean up stuck calls
    if (calls.length > 0) {
      console.log('Cleaning up stuck calls...');
      const result = await Call.updateMany(
        { status: { $in: ['ringing', 'connected', 'initiated'] } },
        { status: 'ended' }
      );
      console.log('Stuck calls cleaned up:', result.modifiedCount, 'calls updated');
    } else {
      console.log('No stuck calls found');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
