'use strict';

const rateLimit = require('express-rate-limit');

/**
 * authLimiter — tight limit for login/register endpoints to prevent brute-force.
 * 10 requests per 15 minutes per IP.
 */
module.exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

/**
 * apiLimiter — general limit for all authenticated API routes.
 * 200 requests per minute per IP.
 */
module.exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
});
