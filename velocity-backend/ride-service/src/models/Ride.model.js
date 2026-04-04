'use strict';

const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true, index: true },
    type:     { type: String, enum: ['car', 'bike', 'carpool'], required: true },
    from:     { type: String, required: true },
    to:       { type: String, required: true },
    fare:     { type: Number, required: true, min: 0 },
    distance: { type: String, default: '' },
    duration: { type: String, default: '' },
    status: {
      type:    String,
      enum:    ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    driverName: { type: String, default: 'Assigning…' },
    driverId:   { type: String, default: null },
    rating:     { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Ride', rideSchema);
