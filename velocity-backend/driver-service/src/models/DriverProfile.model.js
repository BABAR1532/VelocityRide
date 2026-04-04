'use strict';
const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
  userId:        { type: String, required: true, unique: true },
  name:          { type: String, required: true },
  email:         { type: String, required: true },
  phone:         { type: String },
  vehicleType:   { type: String, enum: ['car', 'bike'] },
  licenseNumber: { type: String },
  status:        { type: String, enum: ['active', 'inactive'], default: 'active' },
  availability:  { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
