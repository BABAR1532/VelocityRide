'use strict';

/**
 * RabbitMQ Consumer — Notification Service
 *
 * iv. EVENT-DRIVEN MESSAGING & ASYNCHRONOUS PROCESSING
 *
 * This service does NOT expose any write APIs.
 * It is PURELY event-driven — it subscribes to ALL events on the
 * velocity.events exchange and delegates each to a handler.
 *
 * This keeps the Notification Service fully decoupled from all other services.
 * If notifications fail, the other services are not affected.
 *
 * Exchange:   velocity.events (topic)
 * Queue:      velocity.notifications (durable, bound with # wildcard)
 * Binding:    #  (matches every routing key)
 *
 * Message flow:
 *   Ride booked → ride.booked → [RabbitMQ] → this consumer → create Notification doc
 */

const amqplib  = require('amqplib');
const handlers = require('./handlers');

const EXCHANGE   = 'velocity.events';
const QUEUE      = 'velocity.notifications';
const BINDING    = '#';     // Subscribe to ALL events on the exchange
const MAX_RETRIES = 10;
const RETRY_DELAY = 3000;

module.exports = async function startConsumer(retries = 0) {
  try {
    const url  = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    const conn = await amqplib.connect(url);
    const ch   = await conn.createChannel();

    // Assert exchange (matches what publishers declared)
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    // Declare a durable queue so messages survive broker restarts
    await ch.assertQueue(QUEUE, { durable: true });

    // Bind with '#' — receive every event from every service
    await ch.bindQueue(QUEUE, EXCHANGE, BINDING);

    // Process ONE message at a time (fair dispatch)
    ch.prefetch(1);

    console.log('[Notification Service] Consumer ready — waiting for events on', EXCHANGE);

    ch.consume(QUEUE, async (msg) => {
      if (!msg) return;

      const routingKey = msg.fields.routingKey;
      let payload;

      try {
        payload = JSON.parse(msg.content.toString());
      } catch {
        console.error(`[Notification Service] Could not parse message for key: ${routingKey}`);
        ch.nack(msg, false, false); // discard unparseable messages
        return;
      }

      console.log(`[Notification Service] Received event: ${routingKey}`, payload);

      const handler = handlers[routingKey];
      if (handler) {
        try {
          await handler(payload);
          ch.ack(msg); // Acknowledge only after successful processing
        } catch (err) {
          console.error(`[Notification Service] Handler failed for ${routingKey}:`, err.message);
          // Requeue once; if it fails again, dead-letter it
          ch.nack(msg, false, true);
        }
      } else {
        console.warn(`[Notification Service] No handler for event: ${routingKey} — skipping`);
        ch.ack(msg); // Ack unknown events so they don't pile up
      }
    });

    conn.on('close', () => {
      console.warn('[Notification Service] MQ connection closed — reconnecting…');
      setTimeout(() => startConsumer(), RETRY_DELAY);
    });

  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`[Notification Service] MQ not ready — retry ${retries + 1}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return startConsumer(retries + 1);
    }
    console.error('[Notification Service] Cannot connect to RabbitMQ:', err.message);
  }
};
