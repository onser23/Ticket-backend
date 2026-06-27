const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI mühit dəyişəni təyin edilməyib');
    }
    await mongoose.connect(uri);
    console.log('✅ MongoDB-ə qoşuldu');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB qoşulma xətası:', err.message);
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
