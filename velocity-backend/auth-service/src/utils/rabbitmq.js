'use strict';

/**
 * RabbitMQ utility for the Auth Service.
 *
 * Exchange: velocity.events (topic)
 * Events published:
 *   - user.registered  { userId, name, email }
 */

const amqplib = require('amqplib');

const EXCHANGE      = 'velocity.events';
const EXCHANGE_TYPE = 'topic';
const MAX_RETRIES   = 10;
const RETRY_DELAY   = 3000; // ms

let channel = null;

async function connectMQ(retries = 0) {
  try {
    const url  = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    const conn = await amqplib.connect(url);
    channel    = await conn.createChannel();

    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
    console.log('[Auth Service] RabbitMQ connected, exchange ready:', EXCHANGE);

    conn.on('close', () => {
      console.warn('[Auth Service] RabbitMQ connection closed — reconnecting…');
      channel = null;
      setTimeout(() => connectMQ(), RETRY_DELAY);
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`[Auth Service] RabbitMQ not ready — retry ${retries + 1}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectMQ(retries + 1);
    }
    console.error('[Auth Service] Could not connect to RabbitMQ:', err.message);
  }
}

/**
 * Publish a JSON message to the velocity.events exchange.
 * @param {string} routingKey   e.g. 'user.registered'
 * @param {object} payload      JSON-serialisable object
 */
async function publish(routingKey, payload) {
  if (!channel) {
    console.warn('[Auth Service] RabbitMQ channel not ready, skipping publish:', routingKey);
    return;
  }
  const msg = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
  channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
  console.log(`[Auth Service] Published ${routingKey}:`, payload);
}

module.exports = connectMQ;
module.exports.publish = publish;
