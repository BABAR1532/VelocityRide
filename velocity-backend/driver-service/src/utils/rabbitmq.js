'use strict';

/**
 * RabbitMQ utility for the Driver Service.
 *
 * Exchange: velocity.events (topic)
 *
 * Events consumed:
 *   - user.registered   — create driver profile if role === 'driver'
 *   - ride.booked       — cache pending job in Redis
 *   - ride.accepted     — remove job from Redis cache
 *   - ride.cancelled    — remove job from Redis cache
 *   - ride.completed    — record earnings
 *   - carpool.created   — cache pending carpool job
 *   - carpool.accepted  — remove carpool job from Redis cache
 *   - carpool.cancelled — remove carpool job from Redis cache
 *   - carpool.completed — record earnings
 *   - parcel.booked     — cache pending parcel job
 *   - parcel.accepted   — remove parcel job from Redis cache
 *   - parcel.cancelled  — remove parcel job from Redis cache
 *   - parcel.delivered  — record earnings
 */

const amqplib = require('amqplib');

const EXCHANGE      = 'velocity.events';
const EXCHANGE_TYPE = 'topic';
const MAX_RETRIES   = 10;
const RETRY_DELAY   = 3000; // ms

let channel = null;

/**
 * Connect to RabbitMQ with auto-retry.
 */
async function connectRabbitMQ(retries = 0) {
  try {
    const url  = process.env.RABBITMQ_URL || 'amqp://admin:password@rabbitmq:5672';
    const conn = await amqplib.connect(url);
    channel    = await conn.createChannel();

    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
    console.log('[Driver Service] RabbitMQ connected, exchange ready:', EXCHANGE);

    conn.on('close', () => {
      console.warn('[Driver Service] RabbitMQ connection closed — reconnecting…');
      channel = null;
      setTimeout(() => connectRabbitMQ(), RETRY_DELAY);
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`[Driver Service] RabbitMQ not ready — retry ${retries + 1}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectRabbitMQ(retries + 1);
    }
    console.error('[Driver Service] Could not connect to RabbitMQ:', err.message);
    throw err;
  }
}

/**
 * Subscribe to a routing key on the velocity.events exchange.
 * Creates a durable, exclusive queue named "driver-service.<routingKey>".
 *
 * @param {string}   routingKey  e.g. 'ride.booked'
 * @param {Function} handler     async (parsedPayload) => void
 */
async function consume(routingKey, handler) {
  if (!channel) {
    console.warn(`[Driver Service] RabbitMQ channel not ready, cannot subscribe to ${routingKey}`);
    return;
  }

  const queueName = `driver-service.${routingKey}`;
  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, EXCHANGE, routingKey);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload);
      channel.ack(msg);
    } catch (err) {
      console.error(`[Driver Service] Error handling ${routingKey}:`, err.message);
      channel.nack(msg, false, false); // discard bad message
    }
  });

  console.log(`[Driver Service] Subscribed to ${routingKey} via queue "${queueName}"`);
}

/**
 * Publish a JSON message to the velocity.events exchange.
 * @param {string} routingKey  e.g. 'driver.status.updated'
 * @param {object} payload     JSON-serialisable object
 */
async function publish(routingKey, payload) {
  if (!channel) {
    console.warn('[Driver Service] RabbitMQ channel not ready, skipping publish:', routingKey);
    return;
  }
  const msg = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
  channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
  console.log(`[Driver Service] Published ${routingKey}:`, payload);
}

module.exports = { connectRabbitMQ, consume, publish };
