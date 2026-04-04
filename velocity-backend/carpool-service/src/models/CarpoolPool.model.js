'use strict';

/**
 * CarpoolPool model
 *
 * ii. CONCURRENCY — optimistic locking via Mongoose `versionKey` (__v).
 *
 * When a user tries to join a pool, we perform a conditional
 * findOneAndUpdate that matches both the pool's _id AND its current __v.
 * If another request already modified the document (incremented __v),
 * our update finds 0 documents → we return a 409 conflict.
 *
 * This prevents seat over-subscription without a global lock.
 */

const mongoose = require('mongoose');

const carpoolPoolSchema = new mongoose.Schema(
  {
    creatorId:     { type: String, required: true, index: true },
    from:          { type: String, required: true },
    to:            { type: String, required: true },
    departureTime: { type: Date,   required: true },
    totalSeats:    { type: Number, required: true, min: 1, max: 6 },
    seatsAvailable:{ type: Number, required: true, min: 0 },
    farePerPerson: { type: Number, required: true, min: 0 },
    status:        { type: String, enum: ['open', 'full', 'scheduled', 'in_progress', 'completed', 'departed', 'cancelled'], default: 'open' },
    driverId:      { type: String, default: null },
    driverName:    { type: String, default: null },
  },
  {
    timestamps:  true,
    versionKey:  '__v',   // optimistic lock field — Mongoose manages increments
  },
);

// Automatically mark pool as full when no seats remain
carpoolPoolSchema.pre('save', function (next) {
  if (this.seatsAvailable === 0) this.status = 'full';
  next();
});

module.exports = mongoose.model('CarpoolPool', carpoolPoolSchema);
