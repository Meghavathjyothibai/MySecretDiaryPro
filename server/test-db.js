require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Connection...');
console.log('=================================');

// Check if MONGODB_URI exists
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env file');
  console.log('\nPlease create a .env file in the server folder with:');
  console.log('MONGODB_URI=your_mongodb_connection_string');
  console.log('JWT_SECRET=your_secret_key');
  process.exit(1);
}

// Hide password in logs
const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
console.log('📌 MongoDB URI:', maskedUri);

// Try to connect
mongoose.connect(process.env.MONGODB_URI)
  .then(async (conn) => {
    console.log('✅ MongoDB connected successfully!');
    console.log(`📊 Connected to database: ${conn.connection.name}`);
    console.log(`🌍 Host: ${conn.connection.host}`);
    console.log(`🔌 Port: ${conn.connection.port}`);
    
    // List all collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('\n📚 Collections in database:');
    if (collections.length === 0) {
      console.log('   No collections yet');
    } else {
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }
    
    // Try to import User model and check users
    try {
      const User = require('./models/User');
      const userCount = await User.countDocuments();
      console.log(`\n👥 Total users in database: ${userCount}`);
      
      if (userCount > 0) {
        const sampleUser = await User.findOne().select('-password');
        console.log('📝 Sample user:', sampleUser ? sampleUser.username : 'None');
      }
    } catch (modelError) {
      console.log('⚠️ Could not load User model:', modelError.message);
    }
    
    console.log('\n✅ Database test completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    
    if (err.code) {
      console.error('Error code:', err.code);
    }
    
    // Provide helpful error messages
    if (err.name === 'MongoParseError') {
      console.error('\n🔧 Fix: Your MongoDB connection string is invalid.');
      console.error('   Make sure it starts with mongodb+srv:// or mongodb://');
    } else if (err.name === 'MongoNetworkError') {
      console.error('\n🔧 Fix: Cannot reach MongoDB server. Check:');
      console.error('   1. Your IP address is whitelisted in MongoDB Atlas');
      console.error('   2. Network connection is stable');
      console.error('   3. Database user has correct permissions');
    } else if (err.code === 18) {
      console.error('\n🔧 Fix: Authentication failed. Check:');
      console.error('   1. Username and password in connection string');
      console.error('   2. Database user exists and has access');
    } else if (err.code === 8000) {
      console.error('\n🔧 Fix: Authentication mechanism failed.');
      console.error('   Make sure your password doesn\'t contain special characters that need encoding');
    }
    
    process.exit(1);
  });