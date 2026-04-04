'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const connectDB  = require('./utils/db');
const driverRoutes = require('./routes/driver.routes');
const { connectRabbitMQ, consume } = require('./utils/rabbitmq');
const { getRedis } = require('./utils/redis');
const DriverProfile = require('./models/DriverProfile.model');
const Earning = require('./models/Earning.model');

const app  = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'driver-service' }));
app.use('/', driverRoutes);

app.use((err, req, res, _next) => {
  console.error('[Driver Service Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Helper: save earnings from a completed job ────────────────────────────────
async function saveEarning(msg, jobType) {
  const jobId = msg._id || msg.rideId || msg.parcelId || msg.carpoolId;
  if (!jobId || !msg.driverId || !msg.fare) {
    console.warn(`[Driver Service] Skipping ${jobType} earning – missing fields`, { jobId, driverId: msg.driverId, fare: msg.fare });
    return;
  }
  try {
    await Earning.findOneAndUpdate(
      { jobId },
      {
        driverId:       msg.driverId,
        jobType,
        amount:         msg.fare,
        from:           msg.from || '',
        to:             msg.to || '',
        pickupAddress:  msg.pickupAddress || msg.from || '',
        dropoffAddress: msg.dropoffAddress || msg.to || '',
        trackingCode:   msg.trackingCode || '',
      },
      { upsert: true, new: true }
    );
    console.log(`[Driver Service] Earning saved for ${jobType} job ${jobId} – ₹${msg.fare} for driver ${msg.driverId}`);
  } catch (err) {
    console.error(`[Driver Service] Failed to save earning for ${jobType} ${jobId}:`, err.message);
  }
}

// ─── Helper: cache a pending job in Redis ─────────────────────────────────────
async function cacheJob(vehicleTypes, jobId, job) {
  const redis = getRedis();
  for (const vt of vehicleTypes) {
    await redis.set(`jobs:active:${vt}:${jobId}`, JSON.stringify(job), 'EX', 3600);
    console.log(`[Driver Service] Cached job jobs:active:${vt}:${jobId}`);
  }
}

// ─── Helper: remove a job from Redis across both vehicle types ─────────────────
async function removeJob(jobId) {
  if (!jobId) { console.warn('[Driver Service] removeJob called with null jobId'); return; }
  const redis = getRedis();
  await redis.del(`jobs:active:car:${jobId}`);
  await redis.del(`jobs:active:bike:${jobId}`);
  console.log(`[Driver Service] Removed job from cache: ${jobId}`);
}

async function start() {
  try {
    await connectDB();
    await connectRabbitMQ();

    // ── 1. Driver profile creation on registration ─────────────────────────────
    await consume('user.registered', async (msg) => {
      const { userId, name, email, role, phone, vehicleType, licenseNumber } = msg;
      if (role === 'driver') {
        try {
          await DriverProfile.findOneAndUpdate(
            { userId },
            { name, email, phone, vehicleType, licenseNumber },
            { upsert: true, new: true }
          );
          console.log(`[Driver Service] Profile created for driver ${userId}`);
        } catch (err) {
          console.error(`[Driver Service] Failed to create profile: ${err.message}`);
        }
      }
    });

    // ── 2. Earnings — ride/carpool/parcel completion ────────────────────────────
    await consume('ride.completed',    async (msg) => saveEarning(msg, 'ride'));
    await consume('carpool.completed', async (msg) => saveEarning(msg, 'carpool'));
    await consume('parcel.delivered',  async (msg) => saveEarning(msg, 'parcel'));

    // ── 3. Cache pending ride jobs for drivers ─────────────────────────────────
    await consume('ride.booked', async (msg) => {
      const jobId = msg.rideId || msg._id;
      if (!jobId) return;
      // msg.type is 'car' | 'bike' — use it directly as vehicleType
      const vehicleType = msg.type || 'car';
      const job = { ...msg, _id: jobId, jobType: 'ride' };
      await cacheJob([vehicleType], jobId, job);
    });

    // ── 4. Cache carpool jobs — only once the pool is FULL (car only) ─────────
    // Drivers only see a pool in their job list once all seats are filled.
    await consume('carpool.full', async (msg) => {
      const jobId = msg.poolId || msg._id;
      if (!jobId) return;
      await cacheJob(['car'], jobId, { ...msg, _id: jobId, jobType: 'carpool' });
    });

    // ── 5. Cache parcel jobs (weight-based: >=10kg car only, else both) ─────────
    await consume('parcel.booked', async (msg) => {
      const jobId = msg.parcelId || msg._id;
      if (!jobId) return;
      const job = { ...msg, _id: jobId, jobType: 'parcel', status: 'scheduled' };
      const vehicleTypes = (msg.weight >= 10) ? ['car'] : ['car', 'bike'];
      await cacheJob(vehicleTypes, jobId, job);
    });

    // ── 6. Remove jobs from cache when accepted/cancelled ────────────────────
    // ride events use rideId
    await consume('ride.accepted',   async (msg) => removeJob(msg.rideId || msg._id));
    await consume('ride.cancelled',  async (msg) => removeJob(msg.rideId || msg._id));
    // ride cancelled by driver publishes rideId as well
    await consume('ride.cancelled_by_driver', async (msg) => removeJob(msg.rideId || msg._id));

    // parcel events — parcel claimed = accepted
    await consume('parcel.claimed',    async (msg) => removeJob(msg.parcelId || msg._id));
    await consume('parcel.accepted',   async (msg) => removeJob(msg.parcelId || msg._id));
    await consume('parcel.cancelled',  async (msg) => removeJob(msg.parcelId || msg._id));
    await consume('parcel.cancelled_for_driver', async (msg) => removeJob(msg.parcelId || msg._id));

    // carpool events
    await consume('carpool.accepted',  async (msg) => removeJob(msg._id || msg.poolId || msg.carpoolId));
    await consume('carpool.started',   async (msg) => removeJob(msg._id || msg.poolId || msg.carpoolId));
    // carpool.cancelled is published per-passenger — carry poolId now
    await consume('carpool.cancelled', async (msg) => removeJob(msg.poolId || msg._id || msg.carpoolId));
    // When creator cancels after driver was assigned — clean up driver's Redis job
    await consume('carpool.cancelled_by_creator_for_driver', async (msg) => removeJob(msg.poolId || msg._id || msg.carpoolId));

    app.listen(PORT, () => console.log(`[Driver Service] Running on port ${PORT}`));
  } catch (err) {
    console.error('[Driver Service] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
