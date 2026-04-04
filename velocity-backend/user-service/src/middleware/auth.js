'use strict';

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'velocity_jwt_secret_key';

module.exports = (req, res, next) => {
  // The API Gateway forwards user identity via custom headers after JWT verification.
  // When calls come directly (dev/testing), fall back to Bearer token verification.
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.userId = userId;
    req.userEmail = req.headers['x-user-email'];
    req.userName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name']) : undefined;
    return next();
  }

  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.userId    = payload.sub || payload.id;
    req.userEmail = payload.email;
    req.userName  = payload.name;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
