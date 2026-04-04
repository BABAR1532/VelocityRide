'use strict';
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'velocity_jwt_secret_key';
module.exports = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.userId = userId;
    req.userRole = req.headers['x-user-role'] || 'user';
    try {
      req.userName = decodeURIComponent(req.headers['x-user-name'] || '') || 'Driver';
    } catch (_) {
      req.userName = req.headers['x-user-name'] || 'Driver';
    }
    return next();
  }
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.userId = p.sub || p.id;
    req.userRole = p.role || 'user';
    req.userName = (p.name && String(p.name).trim()) || 'Driver';
    next();
  }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
};
