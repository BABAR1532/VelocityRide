'use strict';
/**
 * Redis caching service for the User Service.
 *
 * Pattern: cache-aside
 *   - On read: check cache first → if miss, query MongoDB → store in cache
 *   - On write: update MongoDB → invalidate (delete) cache
 *
 * Cache key: user:<userId>
 * TTL: PROFILE_CACHE_TTL env var (default 300 seconds / 5 minutes)
 */

const Redis = require('ioredis');

const CACHE_TTL = parseInt(process.env.PROFILE_CACHE_TTL, 10) || 300;

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('connect', () => console.log('[User Service] Redis connected'));
    redis.on('error',   err => console.error('[User Service] Redis error:', err.message));
  }
  return redis;
}

/**
 * Get a cached user profile.
 * @returns {object|null}
 */
async function getCachedUser(userId) {
  try {
    const data = await getRedis().get(`user:${userId}`);
    if (data) {
      console.log(`[Cache HIT] user:${userId}`);
      return JSON.parse(data);
    }
    console.log(`[Cache MISS] user:${userId}`);
    return null;
  } catch (err) {
    console.error('[Cache] getCachedUser error:', err.message);
    return null; // Fail open — never block the request due to cache failure
  }
}

/**
 * Store a user profile in the cache.
 */
async function setCachedUser(userId, userObj) {
  try {
    await getRedis().set(`user:${userId}`, JSON.stringify(userObj), 'EX', CACHE_TTL);
    console.log(`[Cache SET] user:${userId} TTL=${CACHE_TTL}s`);
  } catch (err) {
    console.error('[Cache] setCachedUser error:', err.message);
  }
}

/**
 * Invalidate a user profile cache entry.
 */
async function invalidateCachedUser(userId) {
  try {
    await getRedis().del(`user:${userId}`);
    console.log(`[Cache DEL] user:${userId}`);
  } catch (err) {
    console.error('[Cache] invalidateCachedUser error:', err.message);
  }
}

module.exports = { getCachedUser, setCachedUser, invalidateCachedUser };
