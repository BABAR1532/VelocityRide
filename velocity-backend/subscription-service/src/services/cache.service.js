'use strict';

/**
 * iii. CACHING — Subscription plans are static and expensive to re-compute.
 * Cache them in Redis for 1 hour (PLANS_CACHE_TTL).
 */

const Redis = require('ioredis');

const CACHE_TTL = parseInt(process.env.PLANS_CACHE_TTL, 10) || 3600;
let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      // Avoid long hangs when DNS/Redis is temporarily unavailable.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 100, 1000)),
    });
    redis.on('connect', () => console.log('[Subscription Service] Redis connected'));
    redis.on('error', err => console.error('[Subscription Service] Redis error:', err.message));
  }
  return redis;
}

async function getCachedPlans() {
  try {
    const data = await getRedis().get('plans:all');
    if (data) { console.log('[Cache HIT] plans:all'); return JSON.parse(data); }
    console.log('[Cache MISS] plans:all');
    return null;
  } catch { return null; }
}

async function setCachedPlans(plans) {
  try {
    await getRedis().set('plans:all', JSON.stringify(plans), 'EX', CACHE_TTL);
    console.log(`[Cache SET] plans:all TTL=${CACHE_TTL}s`);
  } catch {}
}

module.exports = { getCachedPlans, setCachedPlans };
