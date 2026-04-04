'use strict';

const { validationResult } = require('express-validator');
const User          = require('../models/User.model');
const SavedLocation = require('../models/SavedLocation.model');
const cache         = require('../services/cache.service');

// ─── GET /users/me ─────────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const { userId } = req;

    // iii. CACHING — check Redis first
    const cached = await cache.getCachedUser(userId);
    if (cached) return res.json({ user: cached, cached: true });

    // Cache miss → query MongoDB
    let user = await User.findById(userId).lean();

    // Lazy creation: if user doesn't exist in this service's DB yet, create it
    if (!user) {
      user = await User.create({
        _id:   userId,
        name:  req.userName || req.userEmail?.split('@')[0] || 'Velocity User',
        email: req.userEmail || '',
      });
      user = user.toObject();
    } else if (req.userName && user.name === req.userEmail?.split('@')[0]) {
      // Auto-fix existing bad lazy creation gracefully during login
      user = await User.findByIdAndUpdate(userId, { $set: { name: req.userName } }, { new: true }).lean();
    }

    // Store in cache
    await cache.setCachedUser(userId, user);
    res.json({ user, cached: false });
  } catch (err) { next(err); }
};

// ─── PUT /users/me ─────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { userId } = req;
    const { name, phone, address, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { ...(name && { name }), ...(phone !== undefined && { phone }), ...(address !== undefined && { address }), ...(avatar && { avatar }) } },
      { new: true, upsert: true, lean: true },
    );

    // iii. CACHING — invalidate stale entry
    await cache.invalidateCachedUser(userId);

    res.json({ user });
  } catch (err) { next(err); }
};

// ─── GET /users/me/locations ────────────────────────────────────────────────────
exports.getLocations = async (req, res, next) => {
  try {
    const locations = await SavedLocation.find({ userId: req.userId }).lean();
    res.json({ locations });
  } catch (err) { next(err); }
};

// ─── POST /users/me/locations ───────────────────────────────────────────────────
exports.addLocation = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const location = await SavedLocation.create({
      userId:  req.userId,
      label:   req.body.label,
      address: req.body.address,
    });
    res.status(201).json({ location });
  } catch (err) { next(err); }
};

// ─── DELETE /users/me/locations/:locationId ─────────────────────────────────────
exports.deleteLocation = async (req, res, next) => {
  try {
    const result = await SavedLocation.findOneAndDelete({
      _id:    req.params.locationId,
      userId: req.userId,
    });
    if (!result) return res.status(404).json({ error: 'Location not found' });
    res.json({ message: 'Location deleted' });
  } catch (err) { next(err); }
};
