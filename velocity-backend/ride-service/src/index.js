'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const connectDB  = require('./utils/db');
const connectMQ  = require('./utils/rabbitmq');
const rideRoutes = require('./routes/ride.routes');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'ride-service' }));
app.use('/rides', rideRoutes);

app.use((err, req, res, _next) => {
  console.error('[Ride Service Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();
  await connectMQ();
  app.listen(PORT, () => console.log(`[Ride Service] Running on port ${PORT}`));
}
start().catch(err => { console.error('[Ride Service] Startup failed:', err.message); process.exit(1); });
