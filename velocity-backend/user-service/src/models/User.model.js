'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:   { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    avatar:  { type: String, default: '' },
    role:    { type: String, enum: ['user', 'driver', 'admin'], default: 'user' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
