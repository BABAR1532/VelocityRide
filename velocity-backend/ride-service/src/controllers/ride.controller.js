'use strict';

/**
 * Ride Controller
 *
 * Addresses requirements:
 *   ii.  Concurrency — distributed lock via lock.service for bookRide
 *   iii. Caching     — Redis TTL cache for fare estimates
 *   iv.  Events      — publishes ride.booked / ride.cancelled / ride.completed
 */

const { validationResult } = require('express-validator');
const Redis  = require('ioredis');
const Ride   = require('../models/Ride.model');
const lock   = require('../services/lock.service');
const mq     = require('../utils/rabbitmq');
const geoRoute   = require('../../../shared/geoRoute');
const membership = require('../../../shared/membership');

const ESTIMATE_TTL = parseInt(process.env.ESTIMATE_CACHE_TTL, 10) || 120;

// ─── Redis client (for fare estimate cache) ────────────────────────────────────
let redis = null;
function getRedis() {
  if (!redis) redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  return redis;
}

// ─── Native Driver Handling (Replaces Mock Drivers) ──────────────────────────────
// In production, drivers would be registered users with role='driver' or separate microservice.
// For now, the user ID hitting the "Accept Ride" endpoint acts as the driver.

// ─── POST /rides/estimate ──────────────────────────────────────────────────────
exports.estimate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { from, to, type } = req.body;

    // iii. Caching — base fare only; member discount applied per-request (cache key excludes membership).
    const cacheKey = `estimate:${from.toLowerCase()}:${to.toLowerCase()}:${type}`;
    let basePayload = null;
    const cached = await getRedis().get(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      basePayload = JSON.parse(cached);
    } else {
      console.log(`[Cache MISS] ${cacheKey}`);
      const geo = await geoRoute.estimateRide(from, to, type);
      basePayload = {
        baseFare: geo.fare,
        distance: geo.distance,
        duration: geo.duration,
        distanceKm: geo.distanceKm,
        durationMin: geo.durationMin,
        type,
        from,
        to,
      };
      await getRedis().set(cacheKey, JSON.stringify(basePayload), 'EX', ESTIMATE_TTL);
    }

    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const d = membership.applyMemberDiscount(
      basePayload.baseFare,
      mem.velocityMember ? mem.memberDiscountPercent : 0,
    );

    res.json({
      fare: d.fare,
      originalFare: d.originalFare,
      memberDiscountAmount: d.memberDiscountAmount,
      velocityMember: d.velocityMember,
      memberDiscountPercent: d.memberDiscountPercent,
      memberPlanName: mem.velocityMember ? mem.planName : null,
      distance: basePayload.distance,
      duration: basePayload.duration,
      distanceKm: basePayload.distanceKm,
      durationMin: basePayload.durationMin,
      type: basePayload.type,
      from: basePayload.from,
      to: basePayload.to,
      cached: Boolean(cached),
    });
  } catch (err) { next(err); }
};

// ─── POST /rides ───────────────────────────────────────────────────────────────
exports.bookRide = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    if (req.userRole === 'driver') {
      return res.status(403).json({ error: 'Driver accounts cannot book rides. Sign in with a rider account.' });
    }

    const { from, to, type } = req.body;

    const geo = await geoRoute.estimateRide(from, to, type);
    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const d = membership.applyMemberDiscount(
      geo.fare,
      mem.velocityMember ? mem.memberDiscountPercent : 0,
    );
    const fare = d.fare;

    const ride = await Ride.create({
      userId:     req.userId,
      type,
      from,
      to,
      fare,
      status:     'pending', // Stays pending until a driver accepts
    });

    await mq.publish('ride.booked', {
      rideId:     ride._id.toString(),
      userId:     req.userId,
      driverName: ride.driverName,
      from,
      to,
      type,
      fare,
      originalFare: d.originalFare,
      velocityMember: d.velocityMember,
    });

    res.status(201).json({
      ride,
      memberPricing: {
        originalFare: d.originalFare,
        memberDiscountAmount: d.memberDiscountAmount,
        velocityMember: d.velocityMember,
        memberDiscountPercent: d.memberDiscountPercent,
        memberPlanName: mem.velocityMember ? mem.planName : null,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /rides/pending ────────────────────────────────────────────────────────
exports.getPendingRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json({ rides });
  } catch (err) { next(err); }
};

// ─── GET /rides/driver/jobs ───────────────────────────────────────────────────
exports.listDriverJobs = async (req, res, next) => {
  try {
    const [pending, active] = await Promise.all([
      Ride.find({ status: 'pending' }).sort({ createdAt: -1 }).lean(),
      Ride.find({
        driverId: req.userId,
        status: { $in: ['accepted', 'in_progress'] },
      }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ pending, active });
  } catch (err) { next(err); }
};

// ─── GET /rides/driver/history ────────────────────────────────────────────────
exports.driverHistory = async (req, res, next) => {
  try {
    const rides = await Ride.find({
      driverId: req.userId,
      status: { $in: ['completed', 'cancelled'] }
    }).sort({ createdAt: -1 }).lean();
    res.json({ rides });
  } catch (err) { next(err); }
};

// ─── GET /rides/driver/earnings-summary ─────────────────────────────────────────
exports.driverEarningsSummary = async (req, res, next) => {
  try {
    const completed = await Ride.find({ driverId: req.userId, status: 'completed' }).lean();
    const totalUsd = completed.reduce((s, r) => s + Number(r.fare || 0), 0);
    res.json({
      completedCount: completed.length,
      totalFareUsd: +totalUsd.toFixed(2),
    });
  } catch (err) { next(err); }
};

// ─── POST /rides/:id/accept ────────────────────────────────────────────────────
exports.acceptRide = async (req, res, next) => {
  try {
    const rideId = req.params.id;
    const driverId = req.userId;
    const driverName = req.userName || 'Driver';

    const ride = await lock.withLock(`lock:ride:${rideId}`, async () => {
      const currentRide = await Ride.findById(rideId);
      if (!currentRide) throw new Error('Ride not found');
      if (currentRide.status !== 'pending') throw new Error('Ride is no longer pending or already accepted');

      currentRide.driverId = driverId;
      currentRide.driverName = driverName;
      currentRide.status = 'accepted';
      await currentRide.save();
      return currentRide;
    });

    await mq.publish('ride.accepted', {
      rideId: ride._id.toString(),
      userId: ride.userId,
      driverId: ride.driverId,
      driverName: ride.driverName,
      from: ride.from,
      to: ride.to,
      type: ride.type,
    });

    res.json({ ride });
  } catch (err) {
    if (err.message === 'Ride is no longer pending or already accepted') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

// ─── PATCH /rides/:id/start (driver picks up passenger) ────────────────────────
exports.startRide = async (req, res, next) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      driverId: req.userId,
      status: 'accepted',
    });
    if (!ride) return res.status(404).json({ error: 'Ride not found or not ready to start' });

    ride.status = 'in_progress';
    await ride.save();

    await mq.publish('ride.started', {
      rideId: ride._id.toString(),
      userId: ride.userId,
      driverId: ride.driverId,
      driverName: ride.driverName,
    });

    res.json({ ride });
  } catch (err) { next(err); }
};

// ─── GET /rides ────────────────────────────────────────────────────────────────
exports.listRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    res.json({ rides });
  } catch (err) { next(err); }
};

// ─── GET /rides/:id ────────────────────────────────────────────────────────────
exports.getRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    const isRider = ride.userId === req.userId;
    const isDriver = ride.driverId === req.userId;
    if (!isRider && !isDriver) return res.status(404).json({ error: 'Ride not found' });
    res.json({ ride });
  } catch (err) { next(err); }
};

// ─── PATCH /rides/:id/cancel ───────────────────────────────────────────────────
exports.cancelRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const isRider = ride.userId === req.userId && req.userRole !== 'driver';
    const isDriver = ride.driverId === req.userId && req.userRole === 'driver';

    if (isRider) {
      if (!['pending', 'accepted'].includes(ride.status)) {
        return res.status(409).json({ error: 'Ride cannot be cancelled' });
      }
      ride.status = 'cancelled';
      await ride.save();
      await mq.publish('ride.cancelled', { rideId: ride._id.toString(), userId: ride.userId });
      if (ride.driverId) {
        await mq.publish('ride.cancelled_by_rider_for_driver', {
          driverId: ride.driverId,
          rideId: ride._id.toString(),
          userId: ride.userId,
          from: ride.from,
          to: ride.to,
        });
      }
      return res.json({ ride });
    }

    if (isDriver) {
      if (!['accepted', 'in_progress'].includes(ride.status)) {
        return res.status(409).json({ error: 'Ride cannot be cancelled' });
      }
      ride.status = 'cancelled';
      await ride.save();
      await mq.publish('ride.cancelled_by_driver', {
        userId: ride.userId,
        rideId: ride._id.toString(),
        driverId: ride.driverId,
        from: ride.from,
        to: ride.to,
      });
      return res.json({ ride });
    }

    return res.status(403).json({ error: 'Not allowed to cancel this ride' });
  } catch (err) { next(err); }
};

// ─── PATCH /rides/:id/complete ─────────────────────────────────────────────────
exports.completeRide = async (req, res, next) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      driverId: req.userId,
      status: 'in_progress',
    });
    if (!ride) return res.status(404).json({ error: 'Ride not found or not in progress' });

    ride.status = 'completed';
    await ride.save();

    await mq.publish('ride.completed', {
      _id: ride._id.toString(),
      rideId: ride._id.toString(),
      userId: ride.userId,
      driverId: ride.driverId,
      fare: ride.fare,
      from: ride.from,
      to: ride.to,
      type: ride.type,
    });
    res.json({ ride });
  } catch (err) { next(err); }
};
