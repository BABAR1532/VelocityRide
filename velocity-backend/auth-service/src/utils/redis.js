'use strict';

const Redis = require('ioredis');

let client = null;

function getRedis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    client.on('connect', () => console.log('[Auth Service] Redis connected'));
    client.on('error',   err => console.error('[Auth Service] Redis error:', err.message));
  }
  return client;
}

module.exports = { getRedis };
