'use strict';

/**
 * RabbitMQ publish utility — Ride Service
 *
 * iv. EVENT-DRIVEN MESSAGING
 *
 * Events published to velocity.events exchange (topic):
 *   ride.booked     — a new ride was successfully booked
 *   ride.completed  — driver marked the ride as done
 *   ride.cancelled  — user cancelled the ride
 */

const amqplib = require('amqplib');

const EXCHANGE    = 'velocity.events';
const MAX_RETRIES = 10;
const RETRY_DELAY = 3000;

let channel = null;

async function connectMQ(retries = 0) {
  try {
    const url  = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    const conn = await amqplib.connect(url);
    channel    = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('[Ride Service] RabbitMQ connected');

    conn.on('close', () => {
      channel = null;
      setTimeout(() => connectMQ(), RETRY_DELAY);
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectMQ(retries + 1);
    }
    console.error('[Ride Service] Cannot connect to RabbitMQ:', err.message);
  }
}

async function publish(routingKey, payload) {
  if (!channel) { console.warn('[Ride Service] MQ channel not ready, skipping:', routingKey); return; }
  const msg = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
  channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
  console.log(`[Ride Service] Published ${routingKey}`);
}

module.exports = connectMQ;
module.exports.publish = publish;
