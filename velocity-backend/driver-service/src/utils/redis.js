'use strict';

/**
 * Redis utility for the Driver Service.
 *
 * Provides a lazy-initialized singleton ioredis client.
 * Uses REDIS_URL env variable (default: redis://localhost:6379).
 */

const Redis = require('ioredis');

let client = null;

function getRedis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    client.on('connect', () => console.log('[Driver Service] Redis connected'));
    client.on('error',   err => console.error('[Driver Service] Redis error:', err.message));
  }
  return client;
}

module.exports = { getRedis };
