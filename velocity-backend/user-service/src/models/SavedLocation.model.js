'use strict';

const mongoose = require('mongoose');

const savedLocationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    label:   { type: String, required: true, trim: true }, // "Home", "Work", etc.
    address: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SavedLocation', savedLocationSchema);
