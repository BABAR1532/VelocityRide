'use strict';

/**
 * Carpool Controller
 *
 * ii. CONCURRENCY CONTROL — Optimistic locking on seat join.
 *
 * Problem: Two riders click "Join Pool" simultaneously for the last seat.
 * Both read seatsAvailable = 1 (before either writes).
 * Without protection, both would decrement and end at -1.
 *
 * Solution: findOneAndUpdate with { _id, __v: currentVersion, seatsAvailable: { $gt: 0 } }
 * and $inc: { seatsAvailable: -1 }, $inc: { __v: 1 }.
 * Only ONE of the concurrent requests will match all conditions. The other
 * gets null back → responds with 409 Conflict.
 *
 * iii. CACHING — Pool list cached in Redis with short TTL (30 sec).
 *
 * iv.  EVENTS  — publishes carpool.joined and carpool.full to RabbitMQ.
 */

const { validationResult } = require('express-validator');
const Redis          = require('ioredis');
const CarpoolPool    = require('../models/CarpoolPool.model');
const CarpoolBooking = require('../models/CarpoolBooking.model');
const mq             = require('../utils/rabbitmq');
const geoRoute       = require('../../../shared/geoRoute');
const membership     = require('../../../shared/membership');

const POOLS_CACHE_TTL = parseInt(process.env.POOL_LIST_CACHE_TTL, 10) || 30;

let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      // Fail fast so API can gracefully fall back to MongoDB when Redis is unstable.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 100, 1000)),
    });
    redis.on('error', (err) => {
      console.warn(`[Carpool][Cache] Redis connection issue: ${err.message}`);
    });
  }
  return redis;
}

const POOLS_CACHE_KEY = 'pools:available';

async function safeCacheGet(key) {
  try {
    return await getRedis().get(key);
  } catch (err) {
    console.warn(`[Carpool][Cache] GET failed for ${key}: ${err.message}`);
    return null;
  }
}

async function safeCacheSet(key, value, ttl) {
  try {
    await getRedis().set(key, value, 'EX', ttl);
  } catch (err) {
    console.warn(`[Carpool][Cache] SET failed for ${key}: ${err.message}`);
  }
}

async function safeCacheDel(key) {
  try {
    await getRedis().del(key);
  } catch (err) {
    console.warn(`[Carpool][Cache] DEL failed for ${key}: ${err.message}`);
  }
}

// ─── GET /carpool/pools ────────────────────────────────────────────────────────
exports.listPools = async (req, res, next) => {
  try {
    const pools = await CarpoolPool.find({ status: 'open', departureTime: { $gt: new Date() } })
      .sort({ departureTime: 1 }).lean();
    const fromCache = false;

    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const pct = mem.velocityMember ? mem.memberDiscountPercent : 0;
    const rate = pct / 100;
    const enriched = pools.map((p) => {
      const base = Number(p.farePerPerson);
      const discounted =
        mem.velocityMember && pct > 0 ? +(base * (1 - rate)).toFixed(2) : null;
      return {
        ...p,
        discountedFarePerPerson: discounted,
        velocityMember: mem.velocityMember,
        memberDiscountPercent: pct,
      };
    });

    res.json({
      pools: enriched,
      cached: fromCache,
      velocityMember: mem.velocityMember,
      memberDiscountPercent: pct,
      memberPlanName: mem.velocityMember ? mem.planName : null,
    });
  } catch (err) { next(err); }
};

// ─── GET /carpool/pools/my-active ──────────────────────────────────────────────
exports.getMyActivePool = async (req, res, next) => {
  try {
    const userId = req.userId;
    const booking = await CarpoolBooking.findOne({ userId, status: 'confirmed' }).lean();
    
    const query = {
      status: { $nin: ['completed', 'cancelled'] },
      $or: [ { creatorId: userId } ]
    };
    if (booking) {
      query.$or.push({ _id: booking.poolId });
    }
    
    const pool = await CarpoolPool.findOne(query).sort({ createdAt: -1 }).lean();
    res.json({ pool: pool || null, isCreator: pool ? pool.creatorId.toString() === userId.toString() : false });
  } catch (err) { next(err); }
};

// ─── GET /carpool/pools/:id ────────────────────────────────────────────────────
exports.getPool = async (req, res, next) => {
  try {
    const pool = await CarpoolPool.findById(req.params.id).lean();
    if (!pool) return res.status(404).json({ error: 'Pool not found' });
    
    const isCreator = pool.creatorId.toString() === req.userId.toString();
    res.json({ pool, isCreator });
  } catch (err) { next(err); }
};

// ─── POST /carpool/pools ───────────────────────────────────────────────────────
exports.createPool = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    // Enforce one active pool per creator
    const activePoolCount = await CarpoolPool.countDocuments({
      creatorId: req.userId,
      status: { $nin: ['completed', 'cancelled'] }
    });
    if (activePoolCount > 0) {
      return res.status(409).json({ error: 'You already have an active carpool. Please complete or delete it first.' });
    }

    const { from, to, departureTime, totalSeats, farePerPerson } = req.body;
    const pool = await CarpoolPool.create({
      creatorId:      req.userId,
      from, to, departureTime,
      totalSeats,
      seatsAvailable: totalSeats,
      farePerPerson,
    });

    // Invalidate cached pool list
    await safeCacheDel(POOLS_CACHE_KEY);

    await mq.publish('carpool.created', {
      _id: pool._id.toString(),
      creatorId: pool.creatorId,
      from: pool.from,
      to: pool.to,
      departureTime: pool.departureTime,
      totalSeats: pool.totalSeats,
      farePerPerson: pool.farePerPerson,
      status: pool.status
    });

    res.status(201).json({ pool });
  } catch (err) { next(err); }
};

// ─── POST /carpool/pools/:id/join ──────────────────────────────────────────────
exports.joinPool = async (req, res, next) => {
  try {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Read current document (including __v)
      const pool = await CarpoolPool.findOne({ _id: req.params.id, status: 'open' }).lean();
      if (!pool) return res.status(404).json({ error: 'Pool not found or not open' });
      if (pool.seatsAvailable < 1) return res.status(409).json({ error: 'Pool is full' });

      // Prevent duplicate join from the same user before touching seat count.
      const existingBooking = await CarpoolBooking.findOne({
        poolId: pool._id,
        userId: req.userId,
        status: 'confirmed',
      }).lean();
      if (existingBooking) {
        return res.status(409).json({ error: 'You have already joined this pool' });
      }

      // ii. OPTIMISTIC LOCK — update only if __v still matches what we read
      const updated = await CarpoolPool.findOneAndUpdate(
        {
          _id:            pool._id,
          __v:            pool.__v,               // version guard
          seatsAvailable: { $gt: 0 },             // seats guard
          status:         'open',
        },
        {
          $inc:  { seatsAvailable: -1, __v: 1 }, // atomically decrement + bump version
        },
        { new: true },
      );

      if (!updated) {
        // Concurrent modification detected — retry
        console.log(`[Carpool] Optimistic lock conflict on pool ${req.params.id}, attempt ${attempt + 1}`);
        continue;
      }

      // Create booking record
      let booking;
      try {
        booking = await CarpoolBooking.create({ poolId: pool._id, userId: req.userId });
      } catch (dupErr) {
        // Important: seat was already decremented above.
        // If booking fails (especially duplicate), restore the seat immediately.
        await CarpoolPool.findByIdAndUpdate(pool._id, {
          $inc: { seatsAvailable: 1 },
          $set: { status: 'open' },
        });
        await safeCacheDel(POOLS_CACHE_KEY);

        if (dupErr.code === 11000) return res.status(409).json({ error: 'You have already joined this pool' });
        throw dupErr;
      }

      // Handle pool full
      if (updated.seatsAvailable === 0) {
        await CarpoolPool.findByIdAndUpdate(pool._id, { $set: { status: 'full' } });
      }

      const mem = await membership.getVelocityMembership(req.headers.authorization);
      const farePricing = membership.applyMemberDiscount(
        Number(updated.farePerPerson),
        mem.velocityMember ? mem.memberDiscountPercent : 0,
      );

      await mq.publish('carpool.joined', {
        poolId:  pool._id.toString(),
        userId:  req.userId,
        from:    updated.from,
        to:      updated.to,
        fare:    farePricing.fare,
        originalFare: farePricing.originalFare,
        velocityMember: farePricing.velocityMember,
      });

      await safeCacheDel(POOLS_CACHE_KEY);

      return res.status(201).json({
        booking,
        pool: updated,
        memberPricing: {
          ...farePricing,
          memberPlanName: mem.velocityMember ? mem.planName : null,
        },
      });
    }

    // Exhausted retries
    return res.status(409).json({ error: 'Too many concurrent requests — please retry' });
  } catch (err) { next(err); }
};

// ─── DELETE /carpool/pools/:id/leave ──────────────────────────────────────────
exports.leavePool = async (req, res, next) => {
  try {
    const booking = await CarpoolBooking.findOneAndDelete({
      poolId: req.params.id,
      userId: req.userId,
      status: 'confirmed',
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Restore seat
    await CarpoolPool.findByIdAndUpdate(req.params.id, {
      $inc: { seatsAvailable: 1 },
      $set: { status: 'open' },
    });

    await safeCacheDel(POOLS_CACHE_KEY);
    res.json({ message: 'Left pool successfully' });
  } catch (err) { next(err); }
};

// ─── POST /carpool/route-estimate — suggested per-seat fare from route (Rs 10/km total ÷ seats)
exports.routeEstimate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { from, to, totalSeats } = req.body;
    const seats = Math.min(6, Math.max(1, parseInt(totalSeats, 10) || 1));
    const distanceKm = await geoRoute.resolveDistanceKm(from, to, 2);
    const durationMin = geoRoute.durationMinutes(distanceKm, 'carpool');
    const totalFareUsd = geoRoute.fareUsdFromDistanceKm(distanceKm, 'carpool');
    const suggestedFarePerPerson = +(totalFareUsd / seats).toFixed(2);
    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const memberPreview = membership.applyMemberDiscount(
      suggestedFarePerPerson,
      mem.velocityMember ? mem.memberDiscountPercent : 0,
    );

    res.json({
      distance: geoRoute.formatDistanceKm(distanceKm),
      duration: geoRoute.formatDurationMin(durationMin),
      suggestedFarePerPerson,
      memberPreviewFarePerPerson: mem.velocityMember ? memberPreview.fare : null,
      velocityMember: mem.velocityMember,
      memberDiscountPercent: mem.velocityMember ? memberPreview.memberDiscountPercent : 0,
      distanceKm,
      durationMin,
    });
  } catch (err) { next(err); }
};

// ─── DELETE /carpool/pools/:id ────────────────────────────────────────────────
exports.deletePool = async (req, res, next) => {
  try {
    const pool = await CarpoolPool.findById(req.params.id);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    if (pool.creatorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'You cannot delete this pool because you did not create it' });
    }
    
    // We remove the block preventing deletion if completed/cancelled,
    // so the creator can always physically purge the pool if they wish.
    
    const poolId = pool._id.toString();
    const bookings = await CarpoolBooking.find({ poolId: req.params.id });

    console.log(`[Carpool] Creator permanently deleting pool ${poolId} (status=${pool.status}, bookings=${bookings.length}, driverId=${pool.driverId || 'none'})`);

    // ── Notify all parties before deletion ──────────────────

    // 1. Notify assigned driver (if any) — includes poolId so driver-service can clean Redis
    if (pool.driverId) {
      await mq.publish('carpool.cancelled_by_creator_for_driver', {
        driverId: pool.driverId,
        poolId,
        _id: poolId,
        from: pool.from,
        to: pool.to,
      });
      console.log(`[Carpool] Notified driver ${pool.driverId} of deletion for pool ${poolId}`);
    }

    // 2. Notify each joined passenger
    for (const booking of bookings) {
      await mq.publish('carpool.cancelled', {
        userId:  booking.userId,
        poolId,
        _id:     poolId,
        from:    pool.from,
        to:      pool.to,
      });
    }

    // 3. Notify the creator themselves
    await mq.publish('carpool.cancelled_by_creator', {
      userId:  pool.creatorId,
      poolId,
      _id:     poolId,
      from:    pool.from,
      to:      pool.to,
    });

    // 4. Physically delete the pool and all associated bookings
    await CarpoolPool.findByIdAndDelete(req.params.id);
    await CarpoolBooking.deleteMany({ poolId: req.params.id });

    await safeCacheDel(POOLS_CACHE_KEY);
    console.log(`[Carpool] Pool ${poolId} hard-deleted successfully`);

    res.json({ message: 'Pool deleted successfully' });
  } catch (err) { next(err); }
};

// ─── POST /carpool/pools/:id/driver-accept ─────────────────────────────────────
// Called by the driver service when a driver accepts a pool job.
// Does NOT decrement seats — just assigns the driver to the pool.
exports.driverAcceptPool = async (req, res, next) => {
  try {
    const driverId   = req.headers['x-user-id'];
    const driverName = decodeURIComponent(req.headers['x-user-name'] || 'Your driver');
    if (!driverId) return res.status(401).json({ error: 'Driver ID missing from request' });

    const pool = await CarpoolPool.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['open', 'full'] }, driverId: null },
      { $set: { driverId, driverName, status: 'scheduled' } },
      { new: true },
    );

    if (!pool) {
      const existing = await CarpoolPool.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Pool not found' });
      if (existing.driverId && existing.driverId !== driverId) {
        return res.status(409).json({ error: 'This pool already has a driver' });
      }
      // Driver is re-accepting their own pool — idempotent
      return res.json({ pool: existing, message: 'Already accepted' });
    }

    // Fetch all confirmed passenger bookings so we notify each of them
    const bookings = await CarpoolBooking.find({ poolId: pool._id, status: 'confirmed' }).lean();
    const passengerIds = bookings.map(b => b.userId);

    await safeCacheDel(POOLS_CACHE_KEY);

    await mq.publish('carpool.accepted', {
      _id:          pool._id.toString(),
      driverId:     pool.driverId,
      driverName,
      from:         pool.from,
      to:           pool.to,
      farePerPerson: pool.farePerPerson,
      fare:         pool.farePerPerson * pool.totalSeats,
      totalSeats:   pool.totalSeats,
      departureTime: pool.departureTime,
      passengerIds,   // all users who joined — notification service will fan out
    });

    res.json({ pool, message: 'Carpool accepted' });
  } catch (err) { next(err); }
};

// ─── PATCH /carpool/pools/:id/start ───────────────────────────────────────────
exports.startPool = async (req, res, next) => {
  try {
    const driverId = req.headers['x-user-id'];
    const driverName = decodeURIComponent(req.headers['x-user-name'] || 'Your driver');
    const pool = await CarpoolPool.findOneAndUpdate(
      { _id: req.params.id, driverId, status: 'scheduled' },
      { $set: { status: 'in_progress' } },
      { new: true },
    );
    if (!pool) return res.status(404).json({ error: 'Pool not found or not in scheduled state' });

    // Notify ALL passengers (and creator) that the ride has started
    const bookings = await CarpoolBooking.find({ poolId: pool._id, status: 'confirmed' }).lean();
    const passengerIds = bookings.map(b => b.userId);
    // include creator if not already in passenger list
    if (!passengerIds.includes(pool.creatorId)) passengerIds.push(pool.creatorId);

    await mq.publish('carpool.started', {
      _id:          pool._id.toString(),
      driverId:     pool.driverId,
      driverName,
      from:         pool.from,
      to:           pool.to,
      farePerPerson: pool.farePerPerson,
      departureTime: pool.departureTime,
      passengerIds,
    });

    await safeCacheDel(POOLS_CACHE_KEY);
    res.json({ pool });
  } catch (err) { next(err); }
};

// ─── PATCH /carpool/pools/:id/complete ────────────────────────────────────────
exports.completePool = async (req, res, next) => {
  try {
    const driverId = req.headers['x-user-id'];
    const pool = await CarpoolPool.findOneAndUpdate(
      { _id: req.params.id, driverId, status: 'in_progress' },
      { $set: { status: 'completed' } },
      { new: true },
    );
    if (!pool) return res.status(404).json({ error: 'Pool not found or not in progress' });

    await safeCacheDel(POOLS_CACHE_KEY);

    // Fetch all passengers to fan-out completion notification
    const bookings = await CarpoolBooking.find({ poolId: pool._id }).lean();
    const passengerIds = bookings.map(b => b.userId);
    if (!passengerIds.includes(pool.creatorId)) passengerIds.push(pool.creatorId);

    await mq.publish('carpool.completed', {
      _id:          pool._id.toString(),
      driverId:     pool.driverId,
      from:         pool.from,
      to:           pool.to,
      fare:         pool.farePerPerson * pool.totalSeats,
      farePerPerson: pool.farePerPerson,
      passengerIds,  // fan-out to all pooled users
    });

    res.json({ pool });
  } catch (err) { next(err); }
};

// ─── PATCH /carpool/pools/:id/cancel ─────────────────────────────────────────
exports.cancelPoolByDriver = async (req, res, next) => {
  try {
    const driverId = req.headers['x-user-id'];
    // Revert pool to 'full' so another driver can take it
    const pool = await CarpoolPool.findOneAndUpdate(
      { _id: req.params.id, driverId, status: { $in: ['scheduled', 'in_progress'] } },
      { $set: { status: 'full', driverId: null, driverName: null } },
      { new: true },
    );
    if (!pool) return res.status(404).json({ error: 'Pool not found or not assigned to you' });

    await safeCacheDel(POOLS_CACHE_KEY);

    // Notify ALL passengers (including creator) that the driver cancelled
    const bookings = await CarpoolBooking.find({ poolId: pool._id }).lean();
    const notifyUserIds = [...bookings.map(b => b.userId)];
    // Also notify creator if not already in bookings
    if (!notifyUserIds.includes(pool.creatorId)) notifyUserIds.push(pool.creatorId);

    for (const userId of notifyUserIds) {
      await mq.publish('carpool.driver_cancelled', {
        userId,
        from: pool.from,
        to: pool.to,
        poolId: pool._id.toString(),
      });
    }

    // Re-publish full so a new driver can see it
    await mq.publish('carpool.full', {
      poolId:        pool._id.toString(),
      _id:           pool._id.toString(),
      from:          pool.from,
      to:            pool.to,
      totalSeats:    pool.totalSeats,
      farePerPerson: pool.farePerPerson,
      departureTime: pool.departureTime,
      creatorId:     pool.creatorId,
      status:        'full',
    });

    res.json({ message: 'Job cancelled successfully', pool });
  } catch (err) { next(err); }
};

// ─── GET /carpool/driver/jobs ──────────────────────────────────────────────────
// Returns active carpool pools assigned to this driver (scheduled or in_progress)
exports.getDriverJobs = async (req, res, next) => {
  try {
    const driverId = req.headers['x-user-id'];
    if (!driverId) return res.status(401).json({ error: 'Driver ID missing' });

    const active = await CarpoolPool.find({
      driverId,
      status: { $in: ['scheduled', 'in_progress'] },
    }).lean();

    res.json({ active });
  } catch (err) { next(err); }
};

// ─── POST /carpool/pools/:id/request-driver ───────────────────────────────────
// Explicitly broadcast the pool to the driver portal
exports.requestDriver = async (req, res, next) => {
  try {
    const userId = req.userId;
    // We allow starting if user is the creator and it's open or full.
    // If it's already scheduled or whatever, we don't broadcast again.
    const pool = await CarpoolPool.findOne({
      _id: req.params.id,
      creatorId: userId,
      status: { $in: ['open', 'full'] }
    });
    
    if (!pool) return res.status(404).json({ error: 'Pool not found or cannot be started right now' });

    await CarpoolPool.findByIdAndUpdate(pool._id, { $set: { status: 'full' } }); // Enforce 'full' semantics for drivers
    await safeCacheDel(POOLS_CACHE_KEY);

    // Publish full pool details so driver-service can display the complete job card
    await mq.publish('carpool.full', {
      poolId:        pool._id.toString(),
      _id:           pool._id.toString(),
      from:          pool.from,
      to:            pool.to,
      totalSeats:    pool.totalSeats,
      farePerPerson: pool.farePerPerson,
      departureTime: pool.departureTime,
      creatorId:     pool.creatorId,
      status:        'full',
    });

    res.json({ message: 'Driver requested successfully', pool });
  } catch (err) { next(err); }
};

// ─── GET /carpool/pools/history ────────────────────────────────────────────────
exports.getMyHistory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const bookings = await CarpoolBooking.find({ userId }).lean();
    
    const query = {
      status: { $in: ['completed', 'cancelled'] },
      $or: [ { creatorId: userId } ]
    };
    if (bookings.length > 0) {
      const poolIds = bookings.map(b => b.poolId);
      query.$or.push({ _id: { $in: poolIds } });
    }
    
    const pools = await CarpoolPool.find(query).sort({ departureTime: -1 }).lean();
    res.json({ history: pools });
  } catch (err) { next(err); }
};
