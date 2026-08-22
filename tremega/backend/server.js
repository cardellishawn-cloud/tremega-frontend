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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/subs', subsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/photos', photosRouter);
app.use('/auth', emailRouter);

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
