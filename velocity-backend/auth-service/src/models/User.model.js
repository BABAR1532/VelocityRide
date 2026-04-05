'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role:          { type: String, enum: ['user', 'customer', 'driver', 'admin'], default: 'user' },
    isActive:      { type: Boolean, default: true },
    phone:         { type: String, trim: true },
    vehicleType:   { type: String, enum: ['car', 'bike'], trim: true },
    licenseNumber: { type: String, trim: true },
  },
  { timestamps: true },
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = function (plainText) {
  return bcrypt.compare(plainText, this.password);
};

// Never expose the hashed password in JSON responses
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
