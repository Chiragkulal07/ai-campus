const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const questionBank = require('../data/questionBank');

router.post('/', requireAuth, async (req, res) => {
  const { name, building, category, difficulty, questionCount, maxParticipants } = req.body;
  if (!name || !building || !category || !questionCount) {
    return res.status(400).json({ error: 'name, building, category and questionCount are required' });
  }

  const creator = await User.findById(req.userId);
  if (!creator) return res.status(404).json({ error: 'creator user not found' });

  const shuffled = [...questionBank].sort(() => Math.random() - 0.5);
  const selectedQuestions = shuffled.slice(0, Math.min(questionCount, questionBank.length));

  const challenge = await Challenge.create({
    name, building, category, difficulty: difficulty || 'EASY',
    questionCount: selectedQuestions.length, maxParticipants: maxParticipants || 10,
    creatorId: req.userId, creatorName: creator.displayName, questions: selectedQuestions
  });

  req.io.emit('challenge:created', {
    id: challenge._id, name: challenge.name, building: challenge.building,
    category: challenge.category, difficulty: challenge.difficulty,
    questionCount: challenge.questionCount, maxParticipants: challenge.maxParticipants,
    currentParticipants: 0, creatorName: challenge.creatorName, status: challenge.status
  });

  res.status(201).json({
    id: challenge._id, name: challenge.name, building: challenge.building,
    category: challenge.category, difficulty: challenge.difficulty,
    questionCount: challenge.questionCount, maxParticipants: challenge.maxParticipants,
    status: challenge.status, creatorName: challenge.creatorName
  });
});

router.get('/', async (req, res) => {
  const filter = { visibility: 'PUBLIC', status: 'OPEN_FOR_JOIN' };
  if (req.query.building) filter.building = req.query.building;

  const challenges = await Challenge.find(filter)
    .select('name building category difficulty questionCount maxParticipants participants creatorName status createdAt')
    .sort({ createdAt: -1 });

  res.json(challenges.map((c) => ({
    id: c._id, name: c.name, building: c.building, category: c.category,
    difficulty: c.difficulty, questionCount: c.questionCount, maxParticipants: c.maxParticipants,
    currentParticipants: c.participants.length, creatorName: c.creatorName, status: c.status
  })));
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'challenge not found' });
  if (challenge.status !== 'OPEN_FOR_JOIN') return res.status(400).json({ error: 'this challenge is no longer open to join' });
  if (challenge.participants.length >= challenge.maxParticipants) return res.status(400).json({ error: 'this challenge is full' });

  const alreadyJoined = challenge.participants.some((p) => p.userId === req.userId);
  if (alreadyJoined) return res.status(409).json({ error: 'you already joined this challenge' });

  const user = await User.findById(req.userId);
  challenge.participants.push({ userId: req.userId, displayName: user.displayName, score: 0, answers: [] });
  await challenge.save();

  user.profile.challengesJoined += 1;
  await user.save();

  res.json({ id: challenge._id, participants: challenge.participants.map((p) => ({ userId: p.userId, displayName: p.displayName })) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'challenge not found' });
  res.json(challenge);
});

module.exports = router;
