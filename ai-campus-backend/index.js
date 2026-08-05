require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const requireAuth = require('./middleware/auth');
const Challenge = require('./models/Challenge');
const questionBank = require('./data/questionBank');
const { io: ioClient } = require('socket.io-client');
const internalSocket = ioClient('http://localhost:4001');

internalSocket.on('connect', () => {
  console.log('api-server connected to realtime-server for broadcasting');
});

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection failed:', err.message));

app.post('/auth/signup', async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password and displayName are all required' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'an account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, displayName });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, displayName: user.displayName }
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid email or password' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user._id, email: user.email, displayName: user.displayName }
  });
});

// Get the logged-in user's own profile
app.get('/profile/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  res.json({
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    profile: user.profile
  });
});

// Create a new challenge
app.post('/challenges', requireAuth, async (req, res) => {
  const { name, building, category, difficulty, questionCount, maxParticipants } = req.body;

  if (!name || !building || !category || !questionCount) {
    return res.status(400).json({ error: 'name, building, category and questionCount are required' });
  }

  const creator = await User.findById(req.userId);
  if (!creator) {
    return res.status(404).json({ error: 'creator user not found' });
  }

  // Pick random questions from the bank — this is a stand-in for real AI generation (Phase 4)
  const shuffled = [...questionBank].sort(() => Math.random() - 0.5);
  const selectedQuestions = shuffled.slice(0, Math.min(questionCount, questionBank.length));

  const challenge = await Challenge.create({
    name,
    building,
    category,
    difficulty: difficulty || 'EASY',
    questionCount: selectedQuestions.length,
    maxParticipants: maxParticipants || 10,
    creatorId: req.userId,
    creatorName: creator.displayName,
    questions: selectedQuestions
  });

  // Tell the realtime-server this challenge exists, so it can broadcast it
  // to every connected browser instantly — no refresh needed
  internalSocket.emit('internal:challenge-created', {
    id: challenge._id,
    name: challenge.name,
    building: challenge.building,
    category: challenge.category,
    difficulty: challenge.difficulty,
    questionCount: challenge.questionCount,
    maxParticipants: challenge.maxParticipants,
    currentParticipants: 0,
    creatorName: challenge.creatorName,
    status: challenge.status
  });

  res.status(201).json({
    id: challenge._id,
    name: challenge.name,
    building: challenge.building,
    category: challenge.category,
    difficulty: challenge.difficulty,
    questionCount: challenge.questionCount,
    maxParticipants: challenge.maxParticipants,
    status: challenge.status,
    creatorName: challenge.creatorName
  });
});

// List public challenges that are still open to join.
// If ?building=CODING_LAB is passed, only that building's challenges are returned.
// If no building is given, challenges from EVERY building are returned (used by "All Challenges").
app.get('/challenges', async (req, res) => {
  const filter = { visibility: 'PUBLIC', status: 'OPEN_FOR_JOIN' };
  if (req.query.building) {
    filter.building = req.query.building;
  }

  const challenges = await Challenge.find(filter)
    .select('name building category difficulty questionCount maxParticipants participants creatorName status createdAt')
    .sort({ createdAt: -1 });

  const summarized = challenges.map((c) => ({
    id: c._id,
    name: c.name,
    building: c.building,
    category: c.category,
    difficulty: c.difficulty,
    questionCount: c.questionCount,
    maxParticipants: c.maxParticipants,
    currentParticipants: c.participants.length,
    creatorName: c.creatorName,
    status: c.status
  }));

  res.json(summarized);
});

// Join a challenge
app.post('/challenges/:id/join', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: 'challenge not found' });
  }

  if (challenge.status !== 'OPEN_FOR_JOIN') {
    return res.status(400).json({ error: 'this challenge is no longer open to join' });
  }

  if (challenge.participants.length >= challenge.maxParticipants) {
    return res.status(400).json({ error: 'this challenge is full' });
  }

  const alreadyJoined = challenge.participants.some((p) => p.userId === req.userId);
  if (alreadyJoined) {
    return res.status(409).json({ error: 'you already joined this challenge' });
  }

  const user = await User.findById(req.userId);
  challenge.participants.push({
    userId: req.userId,
    displayName: user.displayName,
    score: 0,
    answers: []
  });

  await challenge.save();

  // Track that this user has joined a challenge — profile.challengesJoined
  // existed in the schema already but nothing was ever incrementing it.
  user.profile.challengesJoined += 1;
  await user.save();

  res.json({
    id: challenge._id,
    participants: challenge.participants.map((p) => ({ userId: p.userId, displayName: p.displayName }))
  });
});

// Get full details of one challenge (used by the live challenge room later)
app.get('/challenges/:id', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: 'challenge not found' });
  }

  res.json(challenge);
});

// Update the logged-in user's avatar colors
app.put('/profile/avatar', requireAuth, async (req, res) => {
  const { bodyColor, hairColor, outfitColor } = req.body;

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }

  if (bodyColor) user.avatar.bodyColor = bodyColor;
  if (hairColor) user.avatar.hairColor = hairColor;
  if (outfitColor) user.avatar.outfitColor = outfitColor;

  await user.save();

  res.json({ avatar: user.avatar });
});

// Get the list of all available labs (buildings)
app.get('/labs', (req, res) => {
  res.json([
    { id: 'CODING_LAB', name: 'Coding Lab', description: 'DSA, SQL, MCQ and code challenges', mapConfig: { x: 400, y: 300, color: '#188c88' } },
    { id: 'INTERVIEW_HALL', name: 'Interview Hall', description: 'Mock interviews and resume review', mapConfig: { x: 800, y: 300, color: '#5c4535' } },
    { id: 'LIBRARY', name: 'Library', description: 'Document Q&A and research challenges', mapConfig: { x: 400, y: 700, color: '#b08154' } },
    { id: 'EVENT_HALL', name: 'Event Hall', description: 'Hackathons and community events', mapConfig: { x: 800, y: 700, color: '#de9b2a' } }
  ]);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`api-server running on port ${PORT}`));