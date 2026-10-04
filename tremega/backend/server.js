const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRouter = require('./routes/auth');
const bidsRouter = require('./routes/bids');
const subsRouter = require('./routes/subs');
const notificationsRouter = require('./routes/notifications');
const messagesRouter = require('./routes/messages');
const photosRouter = require('./routes/photos');
const emailRouter = require('./routes/email');
const agentRouter = require('./routes/agent');
const checkinsRouter = require('./routes/checkins');
const materialsRouter = require('./routes/materials');
const ordersRouter = require('./routes/orders');
const workOrdersRouter = require('./routes/work-orders');
const activityRouter = require('./routes/activity');
const crewsRouter = require('./routes/crews');
const pushRouter = require('./routes/push');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: explicit allowlist from CORS_ORIGINS (comma-separated), matches the
// c0e0198 fix in TradePro's backend. No wildcard. Requests with no Origin
// header (native app / curl) pass through — 'origin' callback returns true
// only for listed origins and false-y Origin (non-browser clients).
const corsOriginList = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // native app / server-to-server
    if (corsOriginList.includes(origin)) return callback(null, true);
    return callback(null, false); // do not reflect unknown origins
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
// Handle OPTIONS preflight requests for all routes
app.options('*', cors(corsOptions));
// Routes
app.use('/api/auth', authRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/subs', subsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/photos', photosRouter);
app.use('/auth', emailRouter);
app.use('/api/agent', agentRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/activity', activityRouter);
app.use('/api/crews', crewsRouter);
app.use('/api/push', pushRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Tremega backend server running on port ${PORT}`);
});
