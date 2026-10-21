const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');

  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] Connected to MongoDB Atlas (${mongoose.connection.name})`);
}

module.exports = connectDB;
