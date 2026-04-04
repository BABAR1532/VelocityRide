'use strict';

require('dotenv').config();
const express             = require('express');
const cors                = require('cors');
const morgan              = require('morgan');
const connectDB           = require('./utils/db');
const startConsumer       = require('./consumer');
const notifRoutes         = require('./routes/notification.routes');

const app  = express();
const PORT = process.env.PORT || 3006;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.use('/notifications', notifRoutes);

app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));

async function start() {
  await connectDB();

  // iv. EVENT-DRIVEN — start RabbitMQ consumer
  await startConsumer();

  app.listen(PORT, () => console.log(`[Notification Service] Running on port ${PORT}`));
}

start().catch(err => { console.error('[Notification Service] Startup failed:', err.message); process.exit(1); });
