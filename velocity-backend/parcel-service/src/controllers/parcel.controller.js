'use strict';
const { validationResult } = require('express-validator');
const Parcel = require('../models/Parcel.model');
const mq     = require('../utils/rabbitmq');
const geoRoute   = require('../../../shared/geoRoute');
const membership = require('../../../shared/membership');

exports.estimate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    const { pickupAddress, dropoffAddress, weight } = req.body;
    const est = await geoRoute.estimateParcel(pickupAddress, dropoffAddress, weight);
    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const d = membership.applyMemberDiscount(
      est.fare,
      mem.velocityMember ? mem.memberDiscountPercent : 0,
    );
    res.json({
      fare: d.fare,
      originalFare: d.originalFare,
      memberDiscountAmount: d.memberDiscountAmount,
      velocityMember: d.velocityMember,
      memberDiscountPercent: d.memberDiscountPercent,
      memberPlanName: mem.velocityMember ? mem.planName : null,
      estimatedTime: est.estimatedTime,
      distance: est.distance,
      distanceKm: est.distanceKm,
    });
  } catch (err) { next(err); }
};

exports.book = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    if (req.userRole === 'driver') {
      return res.status(403).json({ error: 'Driver accounts cannot book parcels. Sign in with a rider account.' });
    }

    const { pickupAddress, dropoffAddress, weight, packageType } = req.body;
    const est = await geoRoute.estimateParcel(pickupAddress, dropoffAddress, weight);
    const mem = await membership.getVelocityMembership(req.headers.authorization);
    const d = membership.applyMemberDiscount(
      est.fare,
      mem.velocityMember ? mem.memberDiscountPercent : 0,
    );

    const parcel = await Parcel.create({
      userId: req.userId,
      pickupAddress, dropoffAddress, weight, packageType,
      fare: d.fare, estimatedTime: est.estimatedTime,
    });

    await mq.publish('parcel.booked', {
      parcelId:     parcel._id.toString(),
      userId:       req.userId,
      trackingCode: parcel.trackingCode,
      pickupAddress,
      dropoffAddress,
      weight,
      packageType,
      fare: d.fare,
      originalFare: d.originalFare,
      velocityMember: d.velocityMember,
    });

    res.status(201).json({ parcel });
  } catch (err) { next(err); }
};

exports.listParcels = async (req, res, next) => {
  try {
    const parcels = await Parcel.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
    res.json({ parcels });
  } catch (err) { next(err); }
};

exports.getParcel = async (req, res, next) => {
  try {
    const parcel = await Parcel.findById(req.params.id).lean();
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
    const isOwner = parcel.userId === req.userId;
    const isDriver = parcel.driverId === req.userId;
    if (!isOwner && !isDriver) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ parcel });
  } catch (err) { next(err); }
};

exports.listAvailableParcels = async (req, res, next) => {
  try {
    const parcels = await Parcel.find({
      status: 'scheduled',
      $or: [{ driverId: null }, { driverId: '' }],
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ parcels });
  } catch (err) { next(err); }
};

exports.listDriverParcels = async (req, res, next) => {
  try {
    const parcels = await Parcel.find({ driverId: req.userId }).sort({ createdAt: -1 }).lean();
    res.json({ parcels });
  } catch (err) { next(err); }
};

exports.driverParcelHistory = async (req, res, next) => {
  try {
    const parcels = await Parcel.find({
      driverId: req.userId,
      status: { $in: ['delivered', 'cancelled'] }
    }).sort({ createdAt: -1 }).lean();
    res.json({ parcels });
  } catch (err) { next(err); }
};

exports.driverParcelEarnings = async (req, res, next) => {
  try {
    const delivered = await Parcel.find({ driverId: req.userId, status: 'delivered' }).lean();
    const totalUsd = delivered.reduce((s, p) => s + Number(p.fare || 0), 0);
    res.json({
      deliveredCount: delivered.length,
      totalFareUsd: +totalUsd.toFixed(2),
    });
  } catch (err) { next(err); }
};

exports.claimParcel = async (req, res, next) => {
  try {
    const driverName = req.userName || 'Driver';
    const parcel = await Parcel.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'scheduled',
        $or: [{ driverId: null }, { driverId: '' }],
      },
      { $set: { driverId: req.userId, driverName } },
      { new: true },
    );
    if (!parcel) {
      return res.status(409).json({ error: 'Parcel is no longer available or already assigned' });
    }

    await mq.publish('parcel.claimed', {
      userId: parcel.userId,
      trackingCode: parcel.trackingCode,
      driverName: parcel.driverName,
      pickupAddress: parcel.pickupAddress,
      dropoffAddress: parcel.dropoffAddress,
    });

    res.json({ parcel });
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { status } = req.body;
    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });

    const isOwner = parcel.userId === req.userId && req.userRole !== 'driver';
    const isDriver = req.userRole === 'driver' && parcel.driverId === req.userId;

    if (status === 'cancelled') {
      if (!isOwner) {
        return res.status(403).json({ error: 'Only the customer who booked the parcel can cancel it' });
      }
      if (['delivered', 'cancelled'].includes(parcel.status)) {
        return res.status(409).json({ error: 'Parcel cannot be cancelled' });
      }
      parcel.status = 'cancelled';
      await parcel.save();
      if (parcel.driverId) {
        await mq.publish('parcel.cancelled_for_driver', {
          driverId: parcel.driverId,
          userId: parcel.userId,
          trackingCode: parcel.trackingCode,
          pickupAddress: parcel.pickupAddress,
          dropoffAddress: parcel.dropoffAddress,
        });
      }
      return res.json({ parcel });
    }

    if (!isDriver) {
      return res.status(403).json({ error: 'Only the assigned driver can update delivery progress' });
    }
    if (parcel.driverId !== req.userId) {
      return res.status(403).json({ error: 'You are not assigned to this parcel' });
    }
    if (['cancelled', 'delivered'].includes(parcel.status)) {
      return res.status(409).json({ error: 'Parcel is already finished' });
    }

    const allowed = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    if (!allowed.includes(status)) {
      return res.status(422).json({ error: 'Invalid status for driver update' });
    }

    parcel.status = status;
    await parcel.save();

    if (status === 'picked_up') {
      await mq.publish('parcel.picked_up', {
        userId: parcel.userId,
        trackingCode: parcel.trackingCode,
        driverName: parcel.driverName,
      });
    }
    if (status === 'out_for_delivery') {
      await mq.publish('parcel.dispatched', {
        parcelId: parcel._id.toString(),
        userId: parcel.userId,
        trackingCode: parcel.trackingCode,
      });
    }
    if (status === 'delivered') {
      await mq.publish('parcel.delivered', {
        _id: parcel._id.toString(),
        parcelId: parcel._id.toString(),
        userId: parcel.userId,
        driverId: parcel.driverId,
        fare: parcel.fare,
        trackingCode: parcel.trackingCode,
        pickupAddress: parcel.pickupAddress,
        dropoffAddress: parcel.dropoffAddress,
      });
    }

    res.json({ parcel });
  } catch (err) { next(err); }
};
