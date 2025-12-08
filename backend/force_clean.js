const mongoose = require('mongoose');
const Call = require('./src/models/Call');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Delete the specific stuck call by ID
    const stuckCallId = '6935cbeaac849fe24d5996ac';
    
    try {
      const result = await Call.deleteOne({ _id: stuckCallId });
      console.log('Delete result:', result);
      
      if (result.deletedCount > 0) {
        console.log('Stuck call successfully deleted');
      } else {
        console.log('No call found with that ID');
      }
    } catch (error) {
      console.error('Error deleting call:', error);
    }
    
    // Also try to end all ringing calls as backup
    const ringingCalls = await Call.find({ status: 'ringing' });
    console.log('Found ringing calls:', ringingCalls.length);
    
    if (ringingCalls.length > 0) {
      await Call.updateMany({ status: 'ringing' }, { status: 'ended' });
      console.log('All ringing calls ended');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
