'use strict';
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const connectDB    = require('./utils/db');
const connectMQ    = require('./utils/rabbitmq');
const parcelRoutes = require('./routes/parcel.routes');
const app = express();
const PORT = process.env.PORT || 3005;
app.use(cors()); app.use(morgan('dev')); app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'parcel-service' }));
app.use('/parcel', parcelRoutes);
app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
async function start() {
  await connectDB(); await connectMQ();
  app.listen(PORT, () => console.log(`[Parcel Service] Running on port ${PORT}`));
}
start().catch(err => { console.error('[Parcel Service] Startup failed:', err.message); process.exit(1); });
