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
        licenseNumber: '',
        status: 'AVAILABLE',
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
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.rejectedBy || !parsed.rejectedBy.includes(userId)) {
          pending.push(parsed);
        }
      }
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

    const rawActive = [
      ...activeRides.map   (r => ({ ...r, jobType: 'ride'    })),
      ...activeParcels.map (p => ({ ...p, jobType: 'parcel'  })),
      ...activeCarpools.map(c => ({ ...c, jobType: 'carpool' })),
    ];

    // Strict active filter: only count jobs that are truly in-progress
    // PENDING parcels assigned to driver are NOT active (they've been re-queued)
    const active = rawActive.filter(j => {
      if (j.jobType === 'parcel')  return ['ASSIGNED', 'PICKED_UP', 'in_transit', 'out_for_delivery'].includes(j.status);
      if (j.jobType === 'ride')    return ['accepted', 'in_progress'].includes(j.status);
      if (j.jobType === 'carpool') return ['scheduled', 'in_progress'].includes(j.status);
      return false;
    });

    let finalStatus = profile?.status || 'AVAILABLE';
    let finalCurrentJobId = profile?.currentJobId || null;

    // Auto-heal: if driver has no truly-active jobs but DB says BUSY or has a currentJobId, reset them.
    // This is the primary recovery path for ghost/stuck states.
    if (active.length === 0 && (finalStatus === 'BUSY' || finalCurrentJobId)) {
      await DriverProfile.updateOne({ userId }, { status: 'AVAILABLE', currentJobId: null });
      finalStatus = 'AVAILABLE';
      finalCurrentJobId = null;
      console.log(`[Driver Service] Auto-healed stuck driver ${userId} (was: ${finalStatus}, jobId: ${finalCurrentJobId})`);
    }

    res.json({ pending, active, driverStatus: finalStatus, currentJobId: finalCurrentJobId });
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
        status:         e.jobType === 'parcel' ? 'DELIVERED' : 'completed',
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

exports.acceptJob = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    // ── Ensure profile exists (auto-create for drivers whose RabbitMQ event was missed) ──
    await DriverProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          name:         decodeURIComponent(req.headers['x-user-name'] || 'Driver'),
          email:        req.headers['x-user-email'] || '',
          status:       'AVAILABLE',
          currentJobId: null,
        },
      },
      { upsert: true, new: false }
    );

    // ── Nuclear self-heal before atomic claim ──────────────────────────────────
    // Reset the driver to AVAILABLE if they are in ANY non-AVAILABLE state.
    // This handles: stuck BUSY states, legacy 'active' values, and any other
    // stale status that would block the atomic findOneAndUpdate below.
    const stuckProfile = await DriverProfile.findOne({ userId }).lean();
    if (stuckProfile && stuckProfile.status !== 'AVAILABLE') {
      console.log(`[Driver Service] acceptJob: force-resetting driver ${userId} from status='${stuckProfile.status}' (currentJobId: ${stuckProfile.currentJobId || 'none'})`);
      await DriverProfile.updateOne({ userId }, { status: 'AVAILABLE', currentJobId: null });
    }

    // ── Atomic: set BUSY if AVAILABLE (which we just ensured above) ──────────
    const updatedDriver = await DriverProfile.findOneAndUpdate(
      { userId, status: 'AVAILABLE' },
      { status: 'BUSY', currentJobId: req.params.id },
      { new: true }
    );
    if (updatedDriver) {
      console.log(`[Driver Service] acceptJob: driver ${userId} → BUSY for job ${req.params.id}`);
    }
    if (!updatedDriver) {
      // Should be extremely rare — only if a concurrent acceptJob fired between our reset and this update
      const current = await DriverProfile.findOne({ userId }).lean();
      const reason = current
        ? `Driver is currently ${current.status} (jobId: ${current.currentJobId || 'none'})`
        : 'Driver profile not found';
      return res.status(409).json({ error: 'Driver already has an active job or is not available', reason });
    }

    let actionPath;
    if (req.params.type === 'parcel')       actionPath = '/claim';
    else if (req.params.type === 'carpool') actionPath = '/driver-accept';
    else                                    actionPath = '/accept';
    
    const { status, data } = await forwardJobAction(req, 'POST', actionPath);
    if (status >= 400) {
      await DriverProfile.findOneAndUpdate({ userId }, { status: 'AVAILABLE', currentJobId: null });
    }
    res.status(status).json(data);
  } catch (err) { 
    await DriverProfile.findOneAndUpdate({ userId: req.headers['x-user-id'] }, { status: 'AVAILABLE', currentJobId: null });
    res.status(500).json({ error: err.message }); 
  }
};

// ── POST /drivers/jobs/reset-status — emergency self-heal for stuck BUSY state ─
exports.resetStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const profile = await DriverProfile.findOneAndUpdate(
      { userId },
      { status: 'AVAILABLE', currentJobId: null },
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: 'Driver profile not found' });
    res.json({ message: 'Driver status reset to AVAILABLE', profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /drivers/jobs/:type/:id/start ──────────────────────────────────────
exports.startJob = async (req, res) => {
  try {
    let actionPath = '/start';
    let extraBody  = undefined;
    if (req.params.type === 'parcel') {
      actionPath = '/status';
      extraBody  = { status: 'PICKED_UP' };
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
      extraBody  = { status: 'DELIVERED' };
    } else if (req.params.type === 'carpool') {
      actionPath = '/complete';
    }
    const { status, data } = await forwardJobAction(req, 'PATCH', actionPath, extraBody);
    if (status < 400) {
      await DriverProfile.findOneAndUpdate({ userId: req.headers['x-user-id'] }, { status: 'AVAILABLE', currentJobId: null });
    }
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
      extraBody  = { status: 'PENDING' };
    } else if (req.params.type === 'carpool') {
      actionPath = '/cancel';
      extraBody  = undefined;
    }
    const { status, data } = await forwardJobAction(req, 'PATCH', actionPath, extraBody);
    if (status < 400) {
      await DriverProfile.findOneAndUpdate({ userId: req.headers['x-user-id'] }, { status: 'AVAILABLE', currentJobId: null });
    }
    res.status(status).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
