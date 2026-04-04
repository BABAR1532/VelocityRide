'use strict';
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'velocity_jwt_secret_key';
module.exports = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) { req.userId = userId; return next(); }
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.userId = payload.sub || payload.id;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};
