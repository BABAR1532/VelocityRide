'use strict';

const { validationResult }    = require('express-validator');
const { Subscription, PLANS } = require('../models/Subscription.model');
const cache                   = require('../services/cache.service');
const mq                      = require('../utils/rabbitmq');

// ─── GET /subscriptions/plans — iii. CACHED ──────────────────────────────────
exports.getPlans = async (req, res, next) => {
  try {
    const cached = await cache.getCachedPlans();
    if (cached) return res.json({ plans: cached, cached: true });

    // Cache miss — serve from in-memory constant and cache it
    await cache.setCachedPlans(PLANS);
    res.json({ plans: PLANS, cached: false });
  } catch (err) { next(err); }
};

// ─── POST /subscriptions ──────────────────────────────────────────────────────
exports.subscribe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const plan = PLANS.find(p => p.id === req.body.planId);
    if (!plan) return res.status(400).json({ error: 'Invalid plan ID' });

    // Upsert: cancel existing subscription and activate new one
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.userId },
      { $set: { planId: plan.id, planName: plan.name, price: plan.price, status: 'active', startDate: new Date(), endDate } },
      { upsert: true, new: true },
    );

    // iv. EVENT — async notification
    await mq.publish('subscription.activated', {
      userId:   req.userId,
      planName: plan.name,
      price:    plan.price,
    });

    res.status(201).json({ subscription });
  } catch (err) { next(err); }
};

// ─── GET /subscriptions/me ────────────────────────────────────────────────────
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.userId, status: 'active' }).lean();
    res.json({ subscription: subscription || null });
  } catch (err) { next(err); }
};

// ─── DELETE /subscriptions/me ─────────────────────────────────────────────────
exports.cancel = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.userId, status: 'active' },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!subscription) return res.status(404).json({ error: 'No active subscription found' });

    await mq.publish('subscription.cancelled', { userId: req.userId, planName: subscription.planName });

    res.json({ message: 'Subscription cancelled', subscription });
  } catch (err) { next(err); }
};
