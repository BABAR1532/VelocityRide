'use strict';

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'velocity_jwt_secret_key';

/**
 * verifyToken — validates the Authorization: Bearer <token> header.
 * Attaches decoded payload as req.user and forwards the userId header
 * to downstream services so they know who is making the request.
 *
 * Routes under /api/auth are NOT passed through this middleware.
 */
module.exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;

    // Forward user identity to downstream services via custom headers
    req.headers['x-user-id']    = payload.sub || payload.id;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-user-name']  = payload.name ? encodeURIComponent(payload.name) : '';
    req.headers['x-user-role']  = payload.role || 'user';

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired — please refresh' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
