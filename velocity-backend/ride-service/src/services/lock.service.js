'use strict';

/**
 * Distributed Lock Service — Ride Service
 *
 * ii. CONCURRENCY CONTROL
 *
 * Implements a Redis-based distributed lock using the SETNX pattern
 * (SET key value EX ttl NX — atomic set-if-not-exists).
 *
 * Why this matters for ride booking:
 *   Two concurrent requests could attempt to assign the same driver.
 *   The lock ensures only one booking request proceeds for a given
 *   driver at a time, preventing "double-booking".
 *
 * Lock key: lock:driver:<driverId>
 * TTL:       DRIVER_LOCK_TTL env var (default 10 000 ms)
 */

const Redis    = require('ioredis');
const { randomUUID } = require('crypto');

const LOCK_TTL_MS = parseInt(process.env.DRIVER_LOCK_TTL, 10) || 10_000;

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('connect', () => console.log('[Ride Service] Redis connected'));
    redis.on('error',   err => console.error('[Ride Service] Redis error:', err.message));
  }
  return redis;
}

/**
 * Attempt to acquire a lock on `key`.
 * @returns {{ acquired: boolean, token: string|null }}
 *   token must be provided to release() to prevent accidental foreign release.
 */
async function acquireLock(key) {
  const token  = randomUUID();
  const ttlSec = Math.ceil(LOCK_TTL_MS / 1000);
  const result = await getRedis().set(key, token, 'EX', ttlSec, 'NX');

  if (result === 'OK') {
    console.log(`[Lock ACQUIRED] ${key} (token=${token.slice(0, 8)}…, ttl=${ttlSec}s)`);
    return { acquired: true, token };
  }
  console.log(`[Lock FAILED] ${key} — already held`);
  return { acquired: false, token: null };
}

/**
 * Release a lock only if we are still the owner (compare-and-delete via Lua).
 * This prevents a slow process from releasing another process's lock.
 */
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

async function releaseLock(key, token) {
  if (!token) return;
  const released = await getRedis().eval(RELEASE_SCRIPT, 1, key, token);
  if (released) {
    console.log(`[Lock RELEASED] ${key}`);
  } else {
    console.warn(`[Lock EXPIRED] ${key} — already expired or taken by another holder`);
  }
}

/**
 * Convenience: run a function inside a lock. Throws if lock cannot be acquired.
 */
async function withLock(key, fn) {
  const { acquired, token } = await acquireLock(key);
  if (!acquired) {
    const err = new Error('Resource is busy — please retry');
    err.status = 409;
    throw err;
  }
  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}

module.exports = { acquireLock, releaseLock, withLock };
