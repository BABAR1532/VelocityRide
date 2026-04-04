'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: String, required: true, index: true },
    type:    { type: String, enum: ['ride', 'carpool', 'delivery', 'payment', 'system'], default: 'system' },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} }, // extra event data
  },
  { timestamps: true },
);

module.exports = mongoose.model('Notification', notificationSchema);
