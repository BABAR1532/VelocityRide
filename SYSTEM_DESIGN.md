# Velocity — System Design Document
> **Audience:** Developers joining the Velocity team  
> **Purpose:** Understand *why* each pattern was chosen and *exactly where* in the code it lives.  
> **Last updated:** April 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [RabbitMQ — Event-Driven Messaging](#2-rabbitmq--event-driven-messaging)
3. [Redis — Caching](#3-redis--caching)
4. [Rate Limiting](#4-rate-limiting)
5. [Concurrency Control](#5-concurrency-control)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [How It All Fits Together — Full Request Flow](#7-how-it-all-fits-together--full-request-flow)
8. [Infrastructure at a Glance](#8-infrastructure-at-a-glance)

---

## 1. Architecture Overview

Velocity is a **microservices application**. Each feature lives in its own service with its own database. Services never call each other's databases directly — they either use **REST** (for synchronous queries) or **RabbitMQ** (for asynchronous events).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  React Frontend (output/)                                                   │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Gateway  :3000                                                         │
│  • JWT verification       • Rate Limiting       • Role enforcement          │
│  • Reverse proxy to all downstream services                                 │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────────────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
auth  user  ride  carpool parcel  notif  sub  driver   ← microservices
:3001 :3002 :3003  :3004  :3005  :3006 :3007 :3008
   │      │      │      │      │      │      │      │
   └──────┴──────┴──────┴──────┴──────┴──────┴──────┘
                             │ publish / subscribe
                             ▼
                    ┌─────────────────┐
                    │   RabbitMQ      │ velocity.events (topic exchange)
                    └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │     Redis       │ cache + token blacklist
                    └─────────────────┘
```

---

## 2. RabbitMQ — Event-Driven Messaging

### What problem does it solve?

Without RabbitMQ, when a ride is booked the ride-service would have to **directly call** the notification-service and the driver-service to tell them what happened. That creates:
- **Tight coupling** — if the notification-service is down, the booking fails.
- **Slow responses** — the user waits while we notify everybody.

With RabbitMQ, the ride-service simply **publishes one event** and goes on. Every other service that cares picks it up independently, at its own pace.

### The Exchange: `velocity.events`

All services share **one** topic exchange called `velocity.events`. A **topic exchange** lets consumers subscribe to specific patterns using routing keys like `ride.booked`, `parcel.*`, or `#` (everything).

```
ride-service  ──publishes──▶  velocity.events (exchange)
                                    │
                    ┌───────────────┼──────────────────┐
                    ▼               ▼                  ▼
          driver-service    notification-service  (future services)
          Queue: driver-service.ride.booked
          Queue: velocity.notifications
```

### Where it is in the code

| File | What it does |
|------|-------------|
| `driver-service/src/utils/rabbitmq.js` | Core `connectRabbitMQ()`, `consume()`, and `publish()` helpers |
| `driver-service/src/index.js` | Subscribes to ~15 event types on startup |
| `notification-service/src/consumer.js` | Pure consumer — subscribes to ALL events with `#` wildcard |
| `notification-service/src/handlers/index.js` | Maps each routing key to a handler function |
| `auth-service/src/utils/rabbitmq.js` | Publishes `user.registered` after registration |

### Key code: `connectRabbitMQ` with auto-retry

```js
// driver-service/src/utils/rabbitmq.js

const MAX_RETRIES = 10;
const RETRY_DELAY = 3000; // ms

async function connectRabbitMQ(retries = 0) {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL);
    channel    = await conn.createChannel();
    await channel.assertExchange('velocity.events', 'topic', { durable: true });

    // If the connection drops, reconnect automatically
    conn.on('close', () => setTimeout(() => connectRabbitMQ(), RETRY_DELAY));
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY)); // wait 3 sec
      return connectRabbitMQ(retries + 1);               // try again
    }
    throw err;
  }
}
```

> **Why `durable: true`?** If RabbitMQ restarts, durable exchanges and queues survive. Messages are not lost.

### Key code: subscribing to an event (`consume`)

```js
// driver-service/src/utils/rabbitmq.js

async function consume(routingKey, handler) {
  const queueName = `driver-service.${routingKey}`;  // e.g. "driver-service.ride.booked"
  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, 'velocity.events', routingKey);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload);         // run our business logic
      channel.ack(msg);               // tell RabbitMQ "I processed it"
    } catch (err) {
      channel.nack(msg, false, false); // discard bad message (don't requeue forever)
    }
  });
}
```

> **Why `ack` / `nack`?** RabbitMQ holds the message until the consumer explicitly acknowledges it. If the service crashes mid-processing, the message is re-delivered automatically.

### Key code: publishing an event

```js
// auth-service/src/controllers/auth.controller.js — after user registers:

await publish('user.registered', {
  userId: user._id.toString(),
  name, email, role,
  phone, vehicleType, licenseNumber
});
```

```js
// auth-service/src/utils/rabbitmq.js — publish helper:

function publish(routingKey, payload) {
  const msg = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
  channel.publish('velocity.events', routingKey, msg, { persistent: true });
}
```

> **`persistent: true`** — if RabbitMQ restarts before the consumer reads the message, the message is not lost.

### Complete event map

| Routing Key | Publisher | Consumers (what they do) |
|-------------|-----------|--------------------------|
| `user.registered` | auth-service | driver-service (create profile), notification-service (send welcome) |
| `ride.booked` | ride-service | driver-service (cache job in Redis), notification-service (notify rider) |
| `ride.accepted` | ride-service | driver-service (remove job from Redis), notification-service (notify rider) |
| `ride.cancelled` | ride-service | driver-service (remove job), notification-service (notify rider) |
| `ride.cancelled_by_rider_for_driver` | ride-service | driver-service (free driver + remove job), notification-service (notify driver) |
| `ride.completed` | ride-service | driver-service (save earning), notification-service (notify rider) |
| `parcel.booked` | parcel-service | driver-service (cache job), notification-service (notify sender) |
| `parcel.claimed` | parcel-service | driver-service (remove from pending), notification-service (notify sender) |
| `parcel.delivered` | parcel-service | driver-service (save earning + free driver), notification-service (notify sender) |
| `parcel.cancelled_for_driver` | parcel-service | driver-service (free driver), notification-service (notify driver) |
| `carpool.full` | carpool-service | driver-service (cache carpool job), notification-service (log) |
| `carpool.accepted` | carpool-service | driver-service (remove from pending), notification-service (notify passengers) |
| `carpool.started` | carpool-service | driver-service (remove job), notification-service (notify passengers) |
| `carpool.completed` | carpool-service | driver-service (save earning), notification-service (notify passengers) |
| `carpool.cancelled_by_creator_for_driver` | carpool-service | driver-service (free driver), notification-service (notify driver) |
| `subscription.activated` | subscription-service | notification-service (notify user) |

### Notification Service — pure consumer pattern

The notification-service is special: it has **no write APIs at all**. It only lives to react to events.

```js
// notification-service/src/consumer.js

// Bind with '#' — receive EVERY event from EVERY service
await ch.bindQueue('velocity.notifications', 'velocity.events', '#');

ch.prefetch(1);  // Process ONE message at a time — prevents overload

ch.consume(QUEUE, async (msg) => {
  const routingKey = msg.fields.routingKey;   // e.g. "ride.booked"
  const handler = handlers[routingKey];        // look up in handlers/index.js
  if (handler) {
    await handler(payload);
    ch.ack(msg);
  } else {
    ch.ack(msg); // unknown event — acknowledge and skip (don't block the queue)
  }
});
```

> `ch.prefetch(1)` is **fair dispatch** — if the service is busy processing one message, RabbitMQ won't send a second until the first is done. This prevents a slow handler from building up an unbounded backlog in memory.

---

## 3. Redis — Caching

Redis is used in **three distinct ways** across the project.

### 3a. Job Queue Cache (driver-service)

**Problem:** When a ride/parcel/carpool is booked, every available driver needs to see it. We cannot query all microservices from every driver every second — that would create thousands of redundant DB queries.

**Solution:** When a job is booked, the driver-service receives the RabbitMQ event and stores the job in Redis with a short TTL. Drivers poll the Redis cache to get their job feed.

```
ride.booked event  →  driver-service  →  redis.set(`jobs:active:car:${jobId}`, job, EX 3600)
                                                              │
                                            driver polls GET /drivers/jobs
                                                              │
                                            redis.keys(`jobs:active:${vehicleType}:*`)
```

**Code location:** `driver-service/src/index.js`

```js
// When a ride is booked
async function cacheJob(vehicleTypes, jobId, job) {
  const redis = getRedis();
  for (const vt of vehicleTypes) {
    // Key pattern: jobs:active:<vehicleType>:<jobId>
    // TTL: 1 hour — job auto-expires if nobody accepts it
    await redis.set(`jobs:active:${vt}:${jobId}`, JSON.stringify(job), 'EX', 3600);
  }
}

// Called when ride.booked event arrives
await consume('ride.booked', async (msg) => {
  const vehicleType = msg.type || 'car';  // 'car' or 'bike'
  await cacheJob([vehicleType], msg.rideId, { ...msg, jobType: 'ride' });
});

// Parcels go to both vehicle types unless heavy (>=10kg -> car only)
await consume('parcel.booked', async (msg) => {
  const vehicleTypes = (msg.weight >= 10) ? ['car'] : ['car', 'bike'];
  await cacheJob(vehicleTypes, msg.parcelId, { ...msg, jobType: 'parcel' });
});
```

**Reading from cache when driver fetches jobs:**

```js
// driver-service/src/controllers/driver.controller.js — getJobs()

const jobsKeys = await redis.keys(`jobs:active:${vehicleType}:*`);
const pending  = [];
for (const key of jobsKeys) {
  const data = await redis.get(key);
  if (data) {
    const parsed = JSON.parse(data);
    // Don't show jobs this driver already said "no" to
    if (!parsed.rejectedBy || !parsed.rejectedBy.includes(userId)) {
      pending.push(parsed);
    }
  }
}
```

**Removing from cache when a job is claimed or cancelled:**

```js
async function removeJob(jobId) {
  const redis = getRedis();
  await redis.del(`jobs:active:car:${jobId}`);   // remove for car drivers
  await redis.del(`jobs:active:bike:${jobId}`);  // remove for bike drivers
}

// Called on many events:
await consume('ride.accepted',  async (msg) => removeJob(msg.rideId));
await consume('ride.cancelled', async (msg) => removeJob(msg.rideId));
await consume('parcel.claimed', async (msg) => removeJob(msg.parcelId));
// ... and so on for every lifecycle event
```

### 3b. Token Blacklist Cache (auth-service)

**Problem:** JWTs cannot be "revoked" — once issued, they are valid until they expire. If a user logs out, their token could still be used.

**Solution:** On logout, store the refresh token in Redis with a TTL equal to its remaining lifetime. On every token refresh, check this blacklist first.

**Code location:** `auth-service/src/controllers/auth.controller.js`

```js
// POST /auth/logout — blacklist the refresh token
exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  
  // Calculate how many seconds remain on this token
  const decoded = jwt.decode(refreshToken);
  const expiresIn = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  
  // Store in Redis: key = "blacklist:<token>", value = "1", TTL = remaining lifetime
  const redis = getRedis();
  await redis.set(`blacklist:${refreshToken}`, '1', 'EX', expiresIn);
  
  res.json({ message: 'Logged out successfully' });
};

// POST /auth/refresh — check blacklist before issuing new access token
exports.refresh = async (req, res) => {
  const redis       = getRedis();
  const blacklisted = await redis.get(`blacklist:${refreshToken}`);
  if (blacklisted) {
    return res.status(401).json({ error: 'Refresh token has been revoked' });
  }
  // ... issue new access token
};
```

> **Why Redis and not the database?** A blacklist query happens on EVERY token refresh. Redis can handle millions of such lookups per second. MongoDB would be too slow under load, and the data doesn't need to be persisted permanently — it can expire naturally.

### 3c. Utility Caches (other services)

Looking at `docker-compose.yml`, other services have Redis TTL configuration too:

| Service | Env Variable | TTL | What is cached |
|---------|-------------|-----|----------------|
| user-service | `PROFILE_CACHE_TTL=300` | 5 min | User profile data |
| ride-service | `ESTIMATE_CACHE_TTL=120` | 2 min | Fare estimates |
| ride-service | `DRIVER_LOCK_TTL=10000` | 10 sec | Driver lock during acceptance |
| carpool-service | `POOL_LIST_CACHE_TTL=30` | 30 sec | Pool listing |
| subscription-service | `PLANS_CACHE_TTL=3600` | 1 hour | Subscription plan details |

### Redis key naming convention

```
jobs:active:<vehicleType>:<jobId>   →  pending driver job feed
blacklist:<refreshToken>            →  logged-out token
```

---

## 4. Rate Limiting

### What problem does it solve?

Without rate limiting, an attacker can:
- **Brute-force** the login endpoint — try thousands of password combinations per second.
- **DDoS** the API — flood endpoints and crash the service for everyone.

### Where it is in the code

**File:** `api-gateway/src/middleware/rateLimiter.js`  
**Applied in:** `api-gateway/src/index.js`

```js
// api-gateway/src/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');

// Tight limit for login/register — prevents brute-force attacks
module.exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 1000,                  // max 1000 requests per IP per window
  standardHeaders: true,      // send RateLimit-* headers in response
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

// General limit for all authenticated API routes
module.exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1-minute window
  max: 200,             // max 200 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
});
```

### How the limiter is applied

```js
// api-gateway/src/index.js

// Auth routes — tight limiter, no JWT required
app.use('/api/auth', authLimiter, createProxy(SERVICES.auth));

// All other routes — general limiter + JWT check
app.use('/api', apiLimiter, verifyToken);
```

### Request flow with rate limiting

```
Client → POST /api/auth/login
         │
         ▼
    authLimiter
    (15 min window, 1000 req/IP)
         │
    ┌────┴────────────────────┐
    │ Under limit?            │ Over limit?
    ▼                         ▼
  Forward to auth-service   429 Too Many Requests
                            { error: "Too many authentication attempts..." }
```

### What the response headers look like

When a rate limiter is active, the gateway automatically adds these headers to every response:
```
RateLimit-Limit: 200
RateLimit-Remaining: 187
RateLimit-Reset: 1713180600
```

---

## 5. Concurrency Control

### The problem: race conditions when two drivers accept the same job

Without concurrency control:
1. Driver A reads: "I am AVAILABLE"
2. Driver B reads: "I am AVAILABLE"
3. Driver A writes: "set BUSY"
4. Driver B writes: "set BUSY"  ← **double acceptance!**

Both drivers think they have the job. This is a classic **race condition**.

### Solution: Atomic MongoDB `findOneAndUpdate`

MongoDB's `findOneAndUpdate` is **atomic** — it reads and writes in a single database operation. No two operations can interleave.

**Code location:** `driver-service/src/controllers/driver.controller.js` — `acceptJob()`

```js
// Step 1: Atomic claim — "set BUSY only if currently AVAILABLE"
const updatedDriver = await DriverProfile.findOneAndUpdate(
  { userId, status: 'AVAILABLE' },   // condition: MUST be AVAILABLE
  { status: 'BUSY', currentJobId: req.params.id },  // what to write
  { new: true }
);

if (!updatedDriver) {
  // The update returned null → the condition was NOT met
  // Another request already claimed this driver between our read and this write
  return res.status(409).json({ error: 'Driver already has an active job or is not available' });
}
```

> **Why is this safe?** MongoDB runs this as a single atomic operation at the database level. Even if 100 requests arrive at the same millisecond, only ONE will find `status: 'AVAILABLE'` and succeed. All others get `null` back and return a 409.

### The full `acceptJob` flow

```
Request arrives: driver wants to accept job
        │
        ▼
1. findOneAndUpdate (upsert=true, new=false)
   → ensure profile exists (in case RabbitMQ missed the registration event)
        │
        ▼
2. Force-reset if stuck in non-AVAILABLE state
   (self-heal for ghost BUSY states)
        │
        ▼
3. ATOMIC CHECK:
   findOneAndUpdate({ status: 'AVAILABLE' }, { status: 'BUSY', currentJobId })
        │
    ┌───┴──────────────────┐
    │ Success (got doc)     │ Failure (null returned)
    ▼                       ▼
4. Forward to downstream   Return 409 Conflict
   ride/parcel/carpool      "Driver already has active job"
   service
        │
    ┌───┴──────────────────┐
    │ Downstream OK         │ Downstream error
    ▼                       ▼
5. Driver stays BUSY      Reset driver back to AVAILABLE
```

### Auto-heal mechanism (self-healing state)

Bugs can leave a driver stuck as `BUSY` with no real active job. The `getJobs` endpoint detects and recovers from this automatically:

```js
// driver-service/src/controllers/driver.controller.js — getJobs()

// After fetching all active jobs from all downstream services...
const active = rawActive.filter(j => {
  // Only jobs truly in-progress count as "active"
  if (j.jobType === 'parcel')  return ['ASSIGNED', 'PICKED_UP', 'in_transit'].includes(j.status);
  if (j.jobType === 'ride')    return ['accepted', 'in_progress'].includes(j.status);
  if (j.jobType === 'carpool') return ['scheduled', 'in_progress'].includes(j.status);
  return false;
});

// If the driver has zero real active jobs but MongoDB says BUSY → fix it
if (active.length === 0 && (status === 'BUSY' || currentJobId)) {
  await DriverProfile.updateOne({ userId }, { status: 'AVAILABLE', currentJobId: null });
  console.log(`[Driver Service] Auto-healed stuck driver ${userId}`);
}
```

### Manual recovery endpoint

For extreme cases, there is a dedicated endpoint:

```
POST /api/drivers/jobs/reset-status
```

```js
// driver-service/src/controllers/driver.controller.js

exports.resetStatus = async (req, res) => {
  const profile = await DriverProfile.findOneAndUpdate(
    { userId },
    { status: 'AVAILABLE', currentJobId: null },
    { new: true }
  );
  res.json({ message: 'Driver status reset to AVAILABLE', profile });
};
```

---

## 6. Role-Based Access Control (RBAC)

The system enforces roles at **two layers**: the API Gateway (backend) and the React Router (frontend).

### The two roles

| Role | Who | What they can access |
|------|-----|---------------------|
| `user` (or `customer`) | Passenger | Book rides, parcel delivery, carpool, subscriptions, notifications, profile |
| `driver` | Driver | Job feed, job management, earnings dashboard, notifications, profile |

Admins can access everything (bypassed in `requireRole`).

### Layer 1: API Gateway — `requireRole` middleware

**File:** `api-gateway/src/index.js`

```js
// The middleware factory
function requireRole(...roles) {
  return (req, res, next) => {
    let userRole = req.headers['x-user-role'] || 'customer';
    if (userRole === 'user') userRole = 'customer'; // normalize legacy values

    // Admins bypass everything
    if (userRole === 'admin' || roles.includes(userRole)) return next();

    return res.status(403).json({
      error: `Access denied. Route requires role: ${roles.join(' or ')}`
    });
  };
}
```

**Applied to all routes:**

```js
// /api/drivers → ONLY drivers can access
app.use('/api/drivers', requireRole('driver'), createProxy(SERVICES.drivers));

// /api/rides, /api/carpool, /api/parcel → ONLY customers
app.use('/api/rides',   requireRole('customer'), createProxy(SERVICES.rides));
app.use('/api/carpool', requireRole('customer'), createProxy(SERVICES.carpool));
app.use('/api/parcel',  requireRole('customer'), createProxy(SERVICES.parcel));

// /api/users, /api/notifications → both roles
app.use('/api/users',         requireRole('customer', 'driver'), createProxy(SERVICES.users));
app.use('/api/notifications', requireRole('customer', 'driver'), createProxy(SERVICES.notifications));
```

### How the role gets to the gateway

The role is embedded in the JWT at login time and carried by the `verifyToken` middleware:

```js
// auth-service: embed role in JWT
const tokenPayload = { sub: user._id.toString(), email, name, role: user.role };
const accessToken  = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' });

// api-gateway/src/middleware/auth.js: extract and forward
const payload = jwt.verify(token, JWT_SECRET);
req.headers['x-user-role'] = payload.role;   // forwarded to all services
req.headers['x-user-id']   = payload.sub;
req.headers['x-user-name'] = payload.name;
```

> Every microservice receives the user's role and ID via `x-user-role` and `x-user-id` headers — they never decode the JWT themselves.

### Layer 2: Frontend Route Guards (React Router)

**File:** `output/src/app/routes.jsx`

Four guard components enforce role separation in the UI:

```jsx
// Any authenticated user (used as wrapper for main layout)
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Redirect already-logged-in users away from login page
function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return children;
  return user?.role === 'driver'
    ? <Navigate to="/driver/jobs" replace />
    : <Navigate to="/dashboard" replace />;
}

// Passenger-only pages — drivers are redirected to their own dashboard
function PassengerOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === 'driver') return <Navigate to="/driver/jobs" replace />;
  return children;
}

// Driver-only pages — non-drivers are redirected
function DriverOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'driver') return <Navigate to="/dashboard" replace />;
  return children;
}
```

**Applied in the router:**

```jsx
// Passenger-only pages
{ path: 'car-ride',   element: <PassengerOnly><CarRide /></PassengerOnly> },
{ path: 'bike-ride',  element: <PassengerOnly><BikeRide /></PassengerOnly> },
{ path: 'carpool',    element: <PassengerOnly><Carpool /></PassengerOnly> },
{ path: 'parcel',     element: <PassengerOnly><ParcelDelivery /></PassengerOnly> },

// Driver-only pages
{ path: 'driver/jobs',      element: <DriverOnly><DriverJobs /></DriverOnly> },
{ path: 'driver/history',   element: <DriverOnly><DriverHistory /></DriverOnly> },
{ path: 'driver/dashboard', element: <DriverOnly><DriverDashboard /></DriverOnly> },
```

### RBAC authorization flow

```
1. User logs in → role embedded in JWT (e.g. role: "driver")
        │
        ▼
2. Frontend stores JWT in localStorage / AuthContext
        │
        ▼
3. React Router checks role → shows driver UI or passenger UI
        │
        ▼
4. API call made → Bearer <JWT> in Authorization header
        │
        ▼
5. API Gateway:
   a. verifyToken → decodes JWT → adds x-user-role header
   b. requireRole('driver') → checks x-user-role
        │
    ┌───┴────────────────────┐
    │ Role matches           │ Role doesn't match
    ▼                        ▼
  Proxy to microservice    403 Access Denied
```

---

## 7. How It All Fits Together — Full Request Flow

### Example: Passenger books a ride

```
1. POST /api/rides
   → API Gateway: verifyToken OK, requireRole('customer') OK
   → Proxied to ride-service
   → ride-service saves Ride to MongoDB, publishes ride.booked to RabbitMQ

2. RabbitMQ delivers ride.booked to:
   → driver-service:        cacheJob(['car'], rideId, rideData) — stored in Redis
   → notification-service:  createNotification(userId, 'Ride Confirmed!', ...)

3. Driver fetches GET /api/drivers/jobs
   → redis.keys('jobs:active:car:*') — sees the pending ride instantly
   → Driver taps "Accept"

4. POST /api/drivers/jobs/ride/<rideId>/accept
   → driver-service: atomic findOneAndUpdate (AVAILABLE → BUSY)
   → forwards to ride-service: POST /rides/<id>/accept
   → ride-service publishes ride.accepted to RabbitMQ

5. RabbitMQ delivers ride.accepted to:
   → driver-service:        removeJob(rideId) — clears from Redis
   → notification-service:  createNotification(userId, 'Driver Assigned!')
```

---

## 8. Infrastructure at a Glance

All services run in Docker. From `velocity-backend/docker-compose.yml`:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| velocity-mongodb | mongo:7 | 27017 | Primary DB for all services |
| velocity-redis | redis:7-alpine | 6380 (host) | Cache + token blacklist |
| velocity-rabbitmq | rabbitmq:3-management | 5672 (AMQP) / 15672 (UI) | Message broker |
| velocity-redis-commander | rediscommander | 8081 | Visual Redis inspector |
| velocity-api-gateway | custom | 3000 | Single entry point |
| velocity-auth-service | custom | 3001 | Login, register, JWT |
| velocity-user-service | custom | 3002 | User profiles |
| velocity-ride-service | custom | 3003 | Ride bookings |
| velocity-carpool-service | custom | 3004 | Carpool pools |
| velocity-parcel-service | custom | 3005 | Parcel delivery |
| velocity-notification-service | custom | 3006 | Notifications |
| velocity-subscription-service | custom | 3007 | Subscription plans |
| velocity-driver-service | custom | 3008 | Driver profiles + job feed |

### Management UIs (dev only)

- **RabbitMQ Dashboard:** http://localhost:15672 — username: `admin`, password: `password`  
  View queues, message rates, bindings. Useful to verify events are flowing.

- **Redis Commander:** http://localhost:8081  
  Browse all Redis keys visually. Useful to inspect the job cache and token blacklist.

---

*This document should be updated whenever a new system design pattern is added to the project.*
