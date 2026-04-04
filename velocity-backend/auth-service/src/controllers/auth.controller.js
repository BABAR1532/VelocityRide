'use strict';

const jwt               = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User              = require('../models/User.model');
const { getRedis }      = require('../utils/redis');
const { publish }       = require('../utils/rabbitmq');

const JWT_SECRET         = process.env.JWT_SECRET          || 'velocity_jwt_secret_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  || 'velocity_refresh_secret_key';
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN      || '15m';
const JWT_REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function signAccess(payload)  { return jwt.sign(payload, JWT_SECRET,         { expiresIn: JWT_EXPIRES_IN  }); }
function signRefresh(payload) { return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXP }); }

// ─── POST /auth/register ──────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { name, email, password, role: roleIn, phone, vehicleType, licenseNumber } = req.body;
    const role = roleIn === 'driver' ? 'driver' : 'customer';

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const createPayload = { name, email, password, role };
    if (role === 'driver') {
      if (phone) createPayload.phone = phone;
      if (vehicleType) createPayload.vehicleType = vehicleType;
      if (licenseNumber) createPayload.licenseNumber = licenseNumber;
    }

    const user = await User.create(createPayload);

    // Publish event — Notification Service will welcome the user
    await publish('user.registered', { 
      userId: user._id.toString(), 
      name, 
      email,
      role: user.role,
      phone: user.phone,
      vehicleType: user.vehicleType,
      licenseNumber: user.licenseNumber
    });

    const tokenPayload = { sub: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const accessToken  = signAccess(tokenPayload);
    const refreshToken = signRefresh(tokenPayload);

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/login ─────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, password, role: formRole } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Map legacy 'user' to 'customer' logic
    const dbRole = user.role === 'user' ? 'customer' : user.role;
    // For admin, we could allow anything or bypass this if needed, but for now enforce strictly unless admin.
    if (formRole && dbRole !== 'admin' && dbRole !== formRole) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = { sub: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const accessToken  = signAccess(tokenPayload);
    const refreshToken = signRefresh(tokenPayload);

    res.json({ accessToken, refreshToken, user });
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    // Check blacklist
    const redis       = getRedis();
    const blacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (blacklisted) return res.status(401).json({ error: 'Refresh token has been revoked' });

    const payload     = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const tokenPayload = { sub: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    const newAccess   = signAccess(tokenPayload);

    res.json({ accessToken: newAccess });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    next(err);
  }
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    // Verify and blacklist the refresh token in Redis until it naturally expires
    let expiresIn = 7 * 24 * 60 * 60; // default: 7 days in seconds
    try {
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.exp) {
        expiresIn = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      }
    } catch (_) { /* ignore */ }

    const redis = getRedis();
    await redis.set(`blacklist:${refreshToken}`, '1', 'EX', expiresIn);

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/change-password ───────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    // Extract Bearer token manually because this route goes through public Gateway proxy
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Find user
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Compare password
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};
