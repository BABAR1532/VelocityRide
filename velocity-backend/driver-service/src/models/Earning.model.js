'use strict';
const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
  driverId: { type: String, required: true, index: true },
  jobId:    { type: String, required: true, unique: true }, // The ride/parcel/carpool ID
  jobType:  { type: String, enum: ['ride', 'parcel', 'carpool'], required: true },
  amount:   { type: Number, required: true, min: 0 },
  // For history display
  from:           { type: String, default: '' },
  to:             { type: String, default: '' },
  pickupAddress:  { type: String, default: '' },
  dropoffAddress: { type: String, default: '' },
  trackingCode:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Earning', earningSchema);
