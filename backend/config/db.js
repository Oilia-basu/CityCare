// MongoDB connection (Mongoose). Syncs indexes so the double-booking unique index always exists.
const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  await mongoose.syncIndexes();
};

module.exports = connectDB;
