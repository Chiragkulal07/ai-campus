require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initSocket } = require('./socket');
const { createRateLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(cors());
app.use(express.json());

// General limiter — generous, applies to the whole app by default so normal
// page loads (fetching games, profile, challenges, etc.) don't get blocked.
const generalLimiter = createRateLimiter({ capacity: 60, refillPerMinute: 60, prefix: 'general' });

// Strict limiter — only stacked onto /auth below, to actually stop brute-force
// login/signup attempts without punishing normal browsing.
const authLimiter = createRateLimiter({ capacity: 5, refillPerMinute: 5, prefix: 'auth' });

app.use(generalLimiter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});
initSocket(io);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection failed:', err.message));

// Middleware to expose `io` inside routers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Import and use routes
app.use('/auth', authLimiter, require('./routes/auth')); // stricter limit on top of the general one
app.use('/games', require('./routes/games'));
app.use('/challenges', require('./routes/challenges'));
app.use('/interview', require('./routes/interview'));
app.use('/profile', require('./routes/profile'));
app.use('/labs', require('./routes/labs'));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`server running on port ${PORT} (REST + Socket.IO combined)`));