const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const GameMatch = require('../models/GameMatch');

router.post('/', requireAuth, async (req, res) => {
  const { name, maxPlayers, durationSec } = req.body;
  if (!name || !durationSec) return res.status(400).json({ error: 'name and durationSec are required' });

  const creator = await User.findById(req.userId);
  if (!creator) return res.status(404).json({ error: 'creator user not found' });

  const match = await GameMatch.create({
    name, maxPlayers: maxPlayers || 8, durationSec,
    creatorId: req.userId, creatorName: creator.displayName
  });

  req.io.emit('game:created', {
    id: match._id, name: match.name, maxPlayers: match.maxPlayers,
    durationSec: match.durationSec, currentParticipants: 0,
    creatorName: match.creatorName, status: match.status
  });

  res.status(201).json({
    id: match._id, name: match.name, maxPlayers: match.maxPlayers,
    durationSec: match.durationSec, status: match.status, creatorName: match.creatorName
  });
});

router.get('/', async (req, res) => {
  const matches = await GameMatch.find({ status: 'OPEN_FOR_JOIN' })
    .select('name maxPlayers durationSec participants creatorName status createdAt')
    .sort({ createdAt: -1 });

  res.json(matches.map((m) => ({
    id: m._id, name: m.name, maxPlayers: m.maxPlayers, durationSec: m.durationSec,
    currentParticipants: m.participants.length, creatorName: m.creatorName, status: m.status
  })));
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const match = await GameMatch.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'game not found' });
  if (match.status !== 'OPEN_FOR_JOIN') return res.status(400).json({ error: 'this game is no longer open to join' });
  if (match.participants.length >= match.maxPlayers) return res.status(400).json({ error: 'this game is full' });

  const alreadyJoined = match.participants.some((p) => p.userId === req.userId);
  if (alreadyJoined) return res.status(409).json({ error: 'you already joined this game' });

  const user = await User.findById(req.userId);
  match.participants.push({ userId: req.userId, displayName: user.displayName, kills: 0 });
  await match.save();

  res.json({ id: match._id, participants: match.participants.map((p) => ({ userId: p.userId, displayName: p.displayName })) });
});

router.get('/:id', requireAuth, async (req, res) => {
  const match = await GameMatch.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'game not found' });
  res.json(match);
});

module.exports = router;
