'use strict';

const mongoose = require('mongoose');

let isConnected = false;

module.exports = async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  isConnected = true;
  console.log('[Auth Service] MongoDB connected');

  mongoose.connection.on('error', err => console.error('[Auth Service] MongoDB error:', err));
  mongoose.connection.on('disconnected', () => { isConnected = false; });
};
