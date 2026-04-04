'use strict';
const mongoose = require('mongoose');
const parcelSchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  pickupAddress:   { type: String, required: true },
  dropoffAddress:  { type: String, required: true },
  weight:          { type: Number, required: true, min: 0.1 },
  packageType:     { type: String, enum: ['documents','electronics','food','clothing','other'], required: true },
  fare:            { type: Number, required: true },
  estimatedTime:   { type: String  },
  status: {
    type: String,
    enum: ['scheduled','picked_up','in_transit','out_for_delivery','delivered','cancelled'],
    default: 'scheduled'
  },
  driverId:     { type: String, default: null, index: true },
  driverName:   { type: String, default: '' },
  trackingCode: { type: String, unique: true },
}, { timestamps: true });

parcelSchema.pre('save', function(next) {
  if (!this.trackingCode) {
    this.trackingCode = 'VEL-' + Math.random().toString(36).toUpperCase().slice(2, 10);
  }
  next();
});

module.exports = mongoose.model('Parcel', parcelSchema);
