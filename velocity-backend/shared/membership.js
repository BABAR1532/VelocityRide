'use strict';

/**
 * Velocity membership: active subscription → tiered fare discount (Normal 10%, Standard 20%, Premium 30%).
 * Services call subscription-service with the same Authorization header the user sent to the gateway.
 */

const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL || 'http://subscription-service:3007';

/** When subscription is active but plan tier is unknown */
const DEFAULT_MEMBER_DISCOUNT_PERCENT = Number(
  process.env.VELOCITY_DEFAULT_MEMBER_DISCOUNT_PERCENT || 10,
);

function memberDiscountPercentFromSubscription(sub) {
  if (!sub || sub.status !== 'active') return 0;
  const id = String(sub.planId || '').toLowerCase().trim();
  const name = String(sub.planName || '').toLowerCase().trim();
  if (id === 'premium' || name.includes('premium')) return 30;
  if (id === 'standard' || name.includes('standard')) return 20;
  if (
    id === 'basic' ||
    id === 'normal' ||
    name.includes('basic') ||
    name.includes('normal')
  ) {
    return 10;
  }
  return DEFAULT_MEMBER_DISCOUNT_PERCENT;
}

async function getVelocityMembership(authHeader) {
  const empty = {
    velocityMember: false,
    memberDiscountPercent: 0,
    planId: null,
    planName: null,
  };
  const h = authHeader && String(authHeader).trim();
  if (!h || !h.startsWith('Bearer ')) return empty;

  try {
    const res = await fetch(`${SUBSCRIPTION_SERVICE_URL}/subscriptions/me`, {
      headers: { Authorization: h },
    });
    if (!res.ok) return empty;

    const data = await res.json();
    const sub = data.subscription;
    if (!sub || sub.status !== 'active') return empty;

    const memberDiscountPercent = memberDiscountPercentFromSubscription(sub);
    return {
      velocityMember: true,
      memberDiscountPercent,
      planId: sub.planId,
      planName: sub.planName,
    };
  } catch (err) {
    console.warn(`[membership] subscription check failed: ${err.message}`);
    return empty;
  }
}

/**
 * @param {number} baseFareUsd
 * @param {number} memberDiscountPercent Use 0 when not a member (or no active plan)
 */
function applyMemberDiscount(baseFareUsd, memberDiscountPercent) {
  const base = Number(baseFareUsd);
  const pct = Math.max(0, Math.min(100, Math.round(Number(memberDiscountPercent) || 0)));

  if (!base || base <= 0 || Number.isNaN(base)) {
    return {
      fare: 0,
      originalFare: 0,
      memberDiscountAmount: 0,
      velocityMember: false,
      memberDiscountPercent: 0,
    };
  }

  if (pct <= 0) {
    return {
      fare: +base.toFixed(2),
      originalFare: +base.toFixed(2),
      memberDiscountAmount: 0,
      velocityMember: false,
      memberDiscountPercent: 0,
    };
  }

  const rate = pct / 100;
  const discount = +(base * rate).toFixed(2);
  const fare = Math.max(0, +(base - discount).toFixed(2));
  return {
    fare,
    originalFare: +base.toFixed(2),
    memberDiscountAmount: discount,
    velocityMember: true,
    memberDiscountPercent: pct,
  };
}

async function isVelocityMember(authHeader) {
  const m = await getVelocityMembership(authHeader);
  return m.velocityMember;
}

module.exports = {
  DEFAULT_MEMBER_DISCOUNT_PERCENT,
  SUBSCRIPTION_SERVICE_URL,
  getVelocityMembership,
  applyMemberDiscount,
  isVelocityMember,
};
