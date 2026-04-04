'use strict';

const DriverProfile = require('../models/DriverProfile.model');
const Earning = require('../models/Earning.model');
const { getRedis } = require('../utils/redis');

// ── GET /drivers/profile ──────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    let profile = await DriverProfile.findOne({ userId });
    if (!profile) {
      // Return a safe default so the frontend never crashes
      return res.json({
        userId,
        name: req.headers['x-user-name'] || 'Driver',
        email: '',
        phone: '',
        vehicleType: 'car',
        licenseNumber: '',
        status: 'active',
        availability: true,
        _isDefault: true,          // hint for frontend
      });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /drivers/profile ──────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { vehicleType, phone, licenseNumber, availability } = req.body;

    // Build only the fields that were sent
    const update = {};
    if (vehicleType   !== undefined) update.vehicleType   = vehicleType;
    if (phone         !== undefined) update.phone         = phone;
    if (licenseNumber !== undefined) update.licenseNumber = licenseNumber;
    if (availability  !== undefined) update.availability  = availability;

    // upsert:true — auto-create profile if RabbitMQ event was missed at registration
    const profile = await DriverProfile.findOneAndUpdate(
      { userId },
      {
        $set: update,
        // Only set name/email on first creation (setOnInsert)
        $setOnInsert: {
          name:  decodeURIComponent(req.headers['x-user-name'] || 'Driver'),
          email: req.headers['x-user-email'] || '',
        },
      },
      { new: true, upsert: true }
    );

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /drivers/dashboard ────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const earnings = await Earning.find({ driverId: userId });

    let totalEarned = 0;
    let completedRides = 0;
    let completedParcels = 0;

    for (const e of earnings) {
      totalEarned += e.amount;
      if (e.jobType === 'ride' || e.jobType === 'carpool') completedRides++;
      if (e.jobType === 'parcel') completedParcels++;
    }

    res.json({ totalEarned, completedRides, completedParcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /drivers/jobs ─────────────────────────────────────────────────────────
exports.getJobs = async (req, res) => {
  try {
    const userId  = req.headers['x-user-id'];
    const profile = await DriverProfile.findOne({ userId });
    const vehicleType = profile?.vehicleType || 'car';

    const redis = getRedis();

    // Pending jobs from Redis — keyed by vehicleType
    const jobsKeys = await redis.keys(`jobs:active:${vehicleType}:*`);
    const pending  = [];
    for (const key of jobsKeys) {
      const data = await redis.get(key);
      if (data) pending.push(JSON.parse(data));
    }
    pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Helper: fetch active jobs from downstream service
    const fetchActive = async (baseUrl, pathPrefix) => {
      try {
        const r = await fetch(`${baseUrl}/${pathPrefix}/driver/jobs`, {
          headers: {
            'x-user-id':   userId,
            'x-user-role': 'driver',
            'Content-Type': 'application/json',
          },
        });
        const d = await r.json();
        return d.active || d.parcels || [];
      } catch {
        return [];
      }
    };

    const [activeRides, activeParcels, activeCarpools] = await Promise.all([
      fetchActive(process.env.RIDE_SERVICE_URL    || 'http://ride-service:3003',    'rides'),
      fetchActive(process.env.PARCEL_SERVICE_URL  || 'http://parcel-service:3005',  'parcel'),
      fetchActive(process.env.CARPOOL_SERVICE_URL || 'http://carpool-service:3004', 'carpool'),
    ]);

    const active = [
      ...activeRides.map   (r => ({ ...r, jobType: 'ride'    })),
      ...activeParcels.map (p => ({ ...p, jobType: 'parcel'  })),
      ...activeCarpools.map(c => ({ ...c, jobType: 'carpool' })),
    ];

    res.json({ pending, active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /drivers/history ──────────────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const userId  = req.headers['x-user-id'];
    const earnings = await Earning.find({ driverId: userId }).sort({ createdAt: -1 });

    const rides   = [];
    const parcels = [];

    for (const e of earnings) {
      const item = {
        _id:            e.jobId,
        type:           e.jobType,
        fare:           e.amount,
        status:         e.jobType === 'parcel' ? 'delivered' : 'completed',
        createdAt:      e.createdAt,
        from:           e.from || 'Origin',
        to:             e.to   || 'Destination',
        pickupAddress:  e.pickupAddress  || e.from || 'Pickup',
        dropoffAddress: e.dropoffAddress || e.to   || 'Dropoff',
        trackingCode:   e.trackingCode   || e.jobId.slice(-6),
      };
      if (e.jobType === 'parcel') parcels.push(item);
      else                        rides.push(item);
    }

    res.json({ rides, parcels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Safe JSON parse — prevents "Unexpected token <" when downstream returns HTML ──
async function safeJson(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return response.json();
  }
  // Non-JSON body (e.g. proxy HTML error page) — surface a clear error
  const text = await response.text();
  throw new Error(`Service returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
}

// ── Internal: forward job action to the correct downstream service ─────────────
async function forwardJobAction(req, actionMethod, actionPath, extraBody = undefined) {
  const { type, id } = req.params;

  let baseUrl;
  if (type === 'parcel') {
    baseUrl = (process.env.PARCEL_SERVICE_URL  || 'http://parcel-service:3005')  + '/parcel';
  } else if (type === 'carpool') {
    // Carpool pools live under /carpool/pools/:id
    // Note: direct service-to-service call — does NOT go through the gateway
    baseUrl = (process.env.CARPOOL_SERVICE_URL || 'http://carpool-service:3004') + '/carpool/pools';
  } else {
    baseUrl = (process.env.RIDE_SERVICE_URL    || 'http://ride-service:3003')    + '/rides';
  }

  const body = extraBody !== undefined
    ? JSON.stringify(extraBody)
    : req.body ? JSON.stringify(req.body) : undefined;

  const response = await fetch(`${baseUrl}/${id}${actionPath}`, {
    method: actionMethod,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id':   req.headers['x-user-id'],
      'x-user-role': 'driver',
      'x-user-name': req.headers['x-user-name'] || 'Driver',
    },
    body,
  });

  const data = await safeJson(response);
  return { status: response.status, data };
}

// ── POST /drivers/jobs/:type/:id/accept ───────────────────────────────────────
exports.acceptJob = async (req, res) => {
  try {
    let actionPath;
    if (req.params.type === 'parcel')       actionPath = '/claim';
    else if (req.params.type === 'carpool') actionPath = '/driver-accept';
    else                                    actionPath = '/accept';
    const { status, data } = await forwardJobAction(req, 'POST', actionPath);
    res.status(status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── PATCH /drivers/jobs/:type/:id/start ──────────────────────────────────────
exports.startJob = async (req, res) => {
  try {
    let actionPath = '/start';
    let extraBody  = undefined;
    if (req.params.type === 'parcel') {
      actionPath = '/status';
      extraBody  = { status: 'picked_up' };
    } else if (req.params.type === 'carpool') {
      actionPath = '/start';
    }
    const { status, data } = await forwardJobAction(req, 'PATCH', actionPath, extraBody);
    res.status(status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── PATCH /drivers/jobs/:type/:id/complete ────────────────────────────────────
exports.completeJob = async (req, res) => {
  try {
    let actionPath = '/complete';
    let extraBody  = undefined;
    if (req.params.type === 'parcel') {
      actionPath = '/status';
      extraBody  = { status: 'delivered' };
    } else if (req.params.type === 'carpool') {
      actionPath = '/complete';
    }
    const { status, data } = await forwardJobAction(req, 'PATCH', actionPath, extraBody);
    res.status(status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── PATCH /drivers/jobs/:type/:id/cancel ──────────────────────────────────────
exports.cancelJob = async (req, res) => {
  try {
    let actionPath = '/cancel';
    let extraBody  = undefined;
    if (req.params.type === 'parcel') {
      actionPath = '/status';
      extraBody  = { status: 'cancelled' };
    } else if (req.params.type === 'carpool') {
      actionPath = '/cancel';
      extraBody  = undefined;
    }
    const { status, data } = await forwardJobAction(req, 'PATCH', actionPath, extraBody);
    res.status(status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
