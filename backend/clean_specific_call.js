const mongoose = require('mongoose');
const Call = require('./src/models/Call');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Find the specific stuck call
    const stuckCall = await Call.findOne({
      status: 'ringing',
      callerId: '6935639600c95559a0f5ffe6',
      receiverId: '693563c300c95559a0f5ffee'
    });
    
    if (stuckCall) {
      console.log('Found stuck call:', stuckCall);
      await Call.findByIdAndUpdate(stuckCall._id, { status: 'ended' });
      console.log('Stuck call updated to ended status');
    } else {
      console.log('No stuck call found');
    }
    
    // Check all ringing calls
    const allRingingCalls = await Call.find({ status: 'ringing' });
    console.log('All ringing calls:', allRingingCalls.length);
    
    if (allRingingCalls.length > 0) {
      console.log('Ending all ringing calls...');
      await Call.updateMany({ status: 'ringing' }, { status: 'ended' });
      console.log('All ringing calls ended');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
