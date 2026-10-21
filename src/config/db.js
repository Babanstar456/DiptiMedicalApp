const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));

let connecting = null;

// Reuses one connection across requests (important on serverless hosts like Vercel).
function connectDB(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!uri) return Promise.reject(new Error('MONGODB_URI is not set'));

  if (!connecting) {
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        console.log(`[db] Connected to MongoDB Atlas (${m.connection.name})`);
        return m.connection;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
}

module.exports = connectDB;
