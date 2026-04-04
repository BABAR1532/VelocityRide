'use strict';
const amqplib = require('amqplib');
const EXCHANGE = 'velocity.events';
let channel = null;
async function connectMQ(retries = 0) {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672');
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('[Parcel Service] RabbitMQ connected');
    conn.on('close', () => { channel = null; setTimeout(() => connectMQ(), 3000); });
  } catch { if (retries < 10) { await new Promise(r => setTimeout(r, 3000)); return connectMQ(retries + 1); } }
}
async function publish(routingKey, payload) {
  if (!channel) return;
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify({ ...payload, timestamp: new Date().toISOString() })), { persistent: true });
  console.log(`[Parcel Service] Published ${routingKey}`);
}
module.exports = connectMQ;
module.exports.publish = publish;
