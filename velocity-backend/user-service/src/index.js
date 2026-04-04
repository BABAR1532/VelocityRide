'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const connectDB  = require('./utils/db');
const userRoutes = require('./routes/user.routes');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'user-service' }));
app.use('/users', userRoutes);

app.use((err, req, res, _next) => {
  console.error('[User Service Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[User Service] Running on port ${PORT}`));
}).catch(err => { console.error('[User Service] Startup failed:', err.message); process.exit(1); });
