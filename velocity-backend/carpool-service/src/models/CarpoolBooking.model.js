'use strict';

const mongoose = require('mongoose');

const carpoolBookingSchema = new mongoose.Schema(
  {
    poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarpoolPool', required: true },
    userId: { type: String, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  },
  { timestamps: true },
);

// Prevent same user from booking same pool twice
carpoolBookingSchema.index({ poolId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CarpoolBooking', carpoolBookingSchema);
