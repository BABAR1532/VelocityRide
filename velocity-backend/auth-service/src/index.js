'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const connectDB  = require('./utils/db');
const connectMQ  = require('./utils/rabbitmq');
const authRoutes = require('./routes/auth.routes');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Routes
app.use('/auth', authRoutes);

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Auth Service Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();
  await connectMQ();
  app.listen(PORT, () => console.log(`[Auth Service] Running on port ${PORT}`));
}

start().catch(err => {
  console.error('[Auth Service] Failed to start:', err.message);
  process.exit(1);
});
