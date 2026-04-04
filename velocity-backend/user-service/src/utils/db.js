'use strict';

const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log('[User Service] MongoDB connected');
  mongoose.connection.on('error', err => console.error('[User Service] MongoDB error:', err));
};
