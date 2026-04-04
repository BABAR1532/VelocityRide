'use strict';
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const connectDB = require('./utils/db');
const connectMQ = require('./utils/rabbitmq');
const subRoutes = require('./routes/subscription.routes');
const app  = express();
const PORT = process.env.PORT || 3007;
app.use(cors()); app.use(morgan('dev')); app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'subscription-service' }));
app.use('/subscriptions', subRoutes);
app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
async function start() {
  await connectDB(); await connectMQ();
  app.listen(PORT, () => console.log(`[Subscription Service] Running on port ${PORT}`));
}
start().catch(err => { console.error('[Subscription Service] Startup failed:', err.message); process.exit(1); });
