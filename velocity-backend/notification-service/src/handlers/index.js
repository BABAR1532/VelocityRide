'use strict';

/**
 * Event Handlers index — maps routing keys to handler functions.
 *
 * iv. ASYNCHRONOUS PROCESSING
 *
 * Each handler receives the decoded JSON payload from RabbitMQ,
 * creates a Notification document in MongoDB, and could optionally
 * send a push notification / email (stubbed here).
 */

const Notification = require('../models/Notification.model');
const INR_PER_USD = 100;
const toInr = (amount) => `Rs ${(Number(amount || 0) * INR_PER_USD).toFixed(2)}`;

// ── Helper ────────────────────────────────────────────────────────────────────
async function createNotification(userId, type, title, message, meta = {}) {
  const notif = await Notification.create({ userId, type, title, message, meta });
  console.log(`[Notification Service] Created notification for user ${userId}: ${title}`);
  return notif;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function onUserRegistered(payload) {
  const { userId, name } = payload;
  await createNotification(
    userId, 'system',
    'Welcome to Velocity!',
    `Hi ${name}, your account has been created. Start booking rides now!`,
    payload,
  );
}

async function onRideBooked(payload) {
  const { userId, driverName, from, to, fare, type } = payload;
  await createNotification(
    userId, 'ride',
    'Ride Confirmed!',
    `Your ${type} ride from ${from} to ${to} has been confirmed. Driver: ${driverName}. Fare: ${toInr(fare)}.`,
    payload,
  );
}

async function onRideCancelled(payload) {
  const { userId, rideId } = payload;
  await createNotification(
    userId, 'ride',
    'Ride Cancelled',
    `Your ride (ID: ${rideId}) has been cancelled. Any applicable refunds will be processed.`,
    payload,
  );
}

async function onRideAccepted(payload) {
  const { userId, driverName, from, to, type } = payload;
  await createNotification(
    userId, 'ride',
    'Driver assigned',
    `A driver (${driverName || 'your driver'}) accepted your ${type || 'ride'} from ${from} to ${to}.`,
    payload,
  );
}

async function onRideStarted(payload) {
  const { userId, driverName } = payload;
  await createNotification(
    userId, 'ride',
    'Trip started',
    `${driverName || 'Your driver'} has started the trip. You are on the way.`,
    payload,
  );
}

async function onRideCancelledByDriver(payload) {
  const { userId, from, to } = payload;
  await createNotification(
    userId, 'ride',
    'Ride cancelled by driver',
    `Your ride from ${from} to ${to} was cancelled by the driver. Please book again if you still need a ride.`,
    payload,
  );
}

async function onRideCancelledByRiderForDriver(payload) {
  const { driverId, from, to } = payload;
  await createNotification(
    driverId, 'ride',
    'Ride cancelled by customer',
    `The customer cancelled the ride from ${from} to ${to}.`,
    payload,
  );
}

async function onRideCompleted(payload) {
  const { userId, fare } = payload;
  await createNotification(
    userId, 'ride',
    'Ride Completed',
    `Your ride has been completed. Total fare charged: ${toInr(fare)}. Thanks for riding with Velocity!`,
    payload,
  );
}

async function onCarpoolJoined(payload) {
  const { userId, from, to, fare } = payload;
  await createNotification(
    userId, 'carpool',
    'Carpool Joined',
    `You've joined a carpool from ${from} to ${to} for ${toInr(fare)} per person.`,
  );
}

async function onCarpoolCancelled(payload) {
  const { userId, from, to } = payload;
  await createNotification(
    userId, 'carpool',
    'Carpool Cancelled',
    'Your pool ride has been cancelled',
    payload,
  );
}

async function onCarpoolDriverCancelled(payload) {
  const { userId, from, to } = payload;
  await createNotification(
    userId, 'carpool',
    'Driver Cancelled Carpool',
    `The assigned driver for your carpool to ${to} has cancelled. We are looking for a new driver.`,
    payload,
  );
}

async function onCarpoolCancelledByCreatorForDriver(payload) {
  const { driverId, from, to } = payload;
  await createNotification(
    driverId, 'carpool',
    'Pool job cancelled',
    'Pool ride has been cancelled by the creator',
    payload,
  );
}

async function onCarpoolCancelledByCreator(payload) {
  const { userId, from, to } = payload;
  await createNotification(
    userId, 'carpool',
    'Pool Cancelled',
    `Your carpool from ${from} to ${to} has been cancelled. It will appear in your ride history.`,
    payload,
  );
}

async function onCarpoolStarted(payload) {
  const { passengerIds, driverName, from, to } = payload;
  if (!Array.isArray(passengerIds) || passengerIds.length === 0) {
    console.warn('[Notification Service] carpool.started missing passengerIds');
    return;
  }
  await Promise.all(
    passengerIds.map(userId =>
      createNotification(
        userId, 'carpool',
        'Ride Started 🚗',
        `${driverName || 'Your driver'} has started the carpool from ${from} to ${to}. You are on your way!`,
        payload,
      )
    )
  );
}

async function onCarpoolFull(payload) {
  const { from, to } = payload;
  // Pool is now full — driver assignment in progress. Log only (no user id to notify globally).
  console.log(`[Notification Service] Pool ${from}→${to} is now full — awaiting driver acceptance`);
}

async function onCarpoolAccepted(payload) {
  const { passengerIds, driverName, from, to, farePerPerson, departureTime } = payload;
  if (!Array.isArray(passengerIds) || passengerIds.length === 0) {
    console.warn('[Notification Service] carpool.accepted missing passengerIds');
    return;
  }
  const dt = departureTime ? new Date(departureTime).toLocaleString() : '';
  await Promise.all(
    passengerIds.map(userId =>
      createNotification(
        userId, 'carpool',
        'Driver Assigned 🎉',
        `Great news! ${driverName || 'A driver'} has accepted your carpool from ${from} to ${to}.` +
        (farePerPerson ? ` Fare: ${toInr(farePerPerson)}/seat.` : '') +
        (dt ? ` Departure: ${dt}.` : '') +
        ` They are on their way!`,
        payload,
      )
    )
  );
}

async function onCarpoolCompleted(payload) {
  const { passengerIds, from, to, farePerPerson } = payload;
  if (!Array.isArray(passengerIds) || passengerIds.length === 0) {
    console.warn('[Notification Service] carpool.completed missing passengerIds — skipping fan-out');
    return;
  }
  await Promise.all(
    passengerIds.map(userId =>
      createNotification(
        userId, 'carpool',
        'Carpool Completed ✅',
        `Your carpool from ${from} to ${to} has been completed. Fare: ${toInr(farePerPerson || 0)}/seat. Thanks for sharing a ride with Velocity!`,
        payload,
      )
    )
  );
}

async function onParcelBooked(payload) {
  const { userId, trackingCode, pickupAddress, dropoffAddress, fare } = payload;
  await createNotification(
    userId, 'delivery',
    'Parcel Delivery Scheduled',
    `Your parcel (${trackingCode}) from ${pickupAddress} to ${dropoffAddress} has been scheduled. Cost: ${toInr(fare)}.`,
    payload,
  );
}

async function onParcelDispatched(payload) {
  const { userId, trackingCode } = payload;
  await createNotification(
    userId, 'delivery',
    'Parcel Out for Delivery',
    `Your parcel (${trackingCode}) is out for delivery. Expect it soon!`,
    payload,
  );
}

async function onParcelDelivered(payload) {
  const { userId, trackingCode } = payload;
  await createNotification(
    userId, 'delivery',
    'Parcel Delivered',
    `Your parcel (${trackingCode}) has been successfully delivered. Thank you for using Velocity!`,
    payload,
  );
}

async function onParcelClaimed(payload) {
  const { userId, trackingCode, driverName } = payload;
  await createNotification(
    userId, 'delivery',
    'Courier assigned',
    `${driverName || 'A driver'} picked up your delivery request for parcel ${trackingCode}. They will update status as they go.`,
    payload,
  );
}

async function onParcelPickedUp(payload) {
  const { userId, trackingCode, driverName } = payload;
  await createNotification(
    userId, 'delivery',
    'Parcel picked up',
    `Your parcel (${trackingCode}) was picked up by ${driverName || 'your courier'}.`,
    payload,
  );
}

async function onParcelCancelledForDriver(payload) {
  const { driverId, trackingCode } = payload;
  await createNotification(
    driverId, 'delivery',
    'Parcel job cancelled',
    `The customer cancelled parcel ${trackingCode}. You no longer need to deliver this shipment.`,
    payload,
  );
}

async function onSubscriptionActivated(payload) {
  const { userId, planName, price } = payload;
  await createNotification(
    userId, 'payment',
    'Subscription Activated',
    `Your ${planName} subscription (${toInr(price)}/month) is now active. Enjoy your benefits!`,
    payload,
  );
}

async function onSubscriptionCancelled(payload) {
  const { userId, planName } = payload;
  await createNotification(
    userId, 'payment',
    'Subscription Cancelled',
    `Your ${planName} subscription has been cancelled. Benefits continue until end of billing period.`,
    payload,
  );
}

// ── Export routing key → handler map ──────────────────────────────────────────
module.exports = {
  'user.registered':         onUserRegistered,
  'ride.booked':             onRideBooked,
  'ride.accepted':           onRideAccepted,
  'ride.started':            onRideStarted,
  'ride.cancelled':          onRideCancelled,
  'ride.cancelled_by_driver': onRideCancelledByDriver,
  'ride.cancelled_by_rider_for_driver': onRideCancelledByRiderForDriver,
  'ride.completed':          onRideCompleted,
  'carpool.joined':          onCarpoolJoined,
  'carpool.accepted':        onCarpoolAccepted,
  'carpool.started':         onCarpoolStarted,
  'carpool.completed':       onCarpoolCompleted,
  'carpool.cancelled':       onCarpoolCancelled,
  'carpool.driver_cancelled':onCarpoolDriverCancelled,
  'carpool.cancelled_by_creator_for_driver': onCarpoolCancelledByCreatorForDriver,
  'carpool.cancelled_by_creator': onCarpoolCancelledByCreator,
  'carpool.full':            onCarpoolFull,
  'parcel.booked':           onParcelBooked,
  'parcel.claimed':          onParcelClaimed,
  'parcel.picked_up':        onParcelPickedUp,
  'parcel.dispatched':       onParcelDispatched,
  'parcel.delivered':        onParcelDelivered,
  'parcel.cancelled_for_driver': onParcelCancelledForDriver,
  'subscription.activated':  onSubscriptionActivated,
  'subscription.cancelled':  onSubscriptionCancelled,
};
