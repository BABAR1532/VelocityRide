'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { verifyToken } = require('./middleware/auth');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Service URLs ─────────────────────────────────────────────────────────────
const SERVICES = {
  auth:         process.env.AUTH_SERVICE_URL         || 'http://localhost:3001',
  users:        process.env.USER_SERVICE_URL         || 'http://localhost:3002',
  rides:        process.env.RIDE_SERVICE_URL         || 'http://localhost:3003',
  carpool:      process.env.CARPOOL_SERVICE_URL      || 'http://localhost:3004',
  parcel:       process.env.PARCEL_SERVICE_URL       || 'http://localhost:3005',
  notifications:process.env.NOTIFICATION_SERVICE_URL|| 'http://localhost:3006',
  subscriptions:process.env.SUBSCRIPTION_SERVICE_URL|| 'http://localhost:3007',
  drivers:      process.env.DRIVER_SERVICE_URL       || 'http://localhost:3008',
};

// ─── Role Enforcement Middleware ───────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    // Normalizing legacy 'user' to 'customer'
    let userRole = req.headers['x-user-role'] || 'customer';
    if (userRole === 'user') userRole = 'customer';

    if (userRole === 'admin' || roles.includes(userRole)) return next();
    return res.status(403).json({ error: `Access denied. Route requires role: ${roles.join(' or ')}` });
  };
}

// ─── Global Middleware ─────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('combined'));

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// ─── Proxy factory ────────────────────────────────────────────────────────────
/**
 * createProxy builds an http-proxy-middleware proxy to a target service.
 * pathRewrite strips the /api prefix so downstream services see /auth/..., /rides/... etc.
 */
function createProxy(target, pathRewrite = {}) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      error: (err, req, res) => {
        console.error(`[Gateway] Proxy error → ${target}: ${err.message}`);
        res.status(502).json({ error: 'Service temporarily unavailable', service: target });
      },
    },
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes — public (no JWT required) but rate-limited tightly
app.use(
  '/api/auth',
  authLimiter,
  createProxy(SERVICES.auth, { '^/': '/auth/' })
);

// All other /api/* routes require a valid JWT
app.use('/api', apiLimiter, verifyToken);

app.use('/api/drivers',       requireRole('driver'),                      createProxy(SERVICES.drivers,       { '^/api/drivers': '' }));

// Users, notifications, subscriptions: both passengers AND drivers need access
app.use('/api/users',         requireRole('customer', 'driver'),          createProxy(SERVICES.users,         { '^/':         '/users/'         }));
app.use('/api/notifications', requireRole('customer', 'driver'),          createProxy(SERVICES.notifications, { '^/': '/notifications/' }));
app.use('/api/subscriptions', requireRole('customer', 'driver'),          createProxy(SERVICES.subscriptions, { '^/': '/subscriptions/' }));

// Ride / carpool / parcel: passengers only
app.use('/api/rides',         requireRole('customer'),                    createProxy(SERVICES.rides,         { '^/':         '/rides/'         }));
app.use('/api/carpool',       requireRole('customer'),                    createProxy(SERVICES.carpool,       { '^/':       '/carpool/'       }));
app.use('/api/parcel',        requireRole('customer'),                    createProxy(SERVICES.parcel,        { '^/':        '/parcel/'        }));

// 404 fallthrough
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
  console.log('[API Gateway] Proxying to:');
  Object.entries(SERVICES).forEach(([k, v]) => console.log(`  /api/${k} → ${v}`));
});
