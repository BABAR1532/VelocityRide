'use strict';

const mongoose = require('mongoose');

module.exports = async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Ride Service] MongoDB connected');
  mongoose.connection.on('error', err => console.error('[Ride Service] MongoDB error:', err));
};
