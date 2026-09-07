const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const GameMatch = require('../models/GameMatch');

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ id: user._id, email: user.email, displayName: user.displayName, avatar: user.avatar, profile: user.profile });
});

router.put('/avatar', requireAuth, async (req, res) => {
  const { bodyColor, hairColor, outfitColor } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  if (bodyColor) user.avatar.bodyColor = bodyColor;
  if (hairColor) user.avatar.hairColor = hairColor;
  if (outfitColor) user.avatar.outfitColor = outfitColor;

  await user.save();
  res.json({ avatar: user.avatar });
});

router.get('/me/games', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('gameHistory');
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json(user.gameHistory || []);
});

router.get('/me/summary', requireAuth, async (req, res) => {
  const buildings = ['CODING_LAB', 'LIBRARY', 'EVENT_HALL'];
  const labSummaries = [];

  for (const building of buildings) {
    const challenges = await Challenge.find({
      building, status: 'COMPLETED', 'participants.userId': req.userId
    }).select('participants questionCount');

    let totalMatches = 0, totalCorrect = 0, totalQuestions = 0;

    challenges.forEach((c) => {
      const me = c.participants.find((p) => p.userId === req.userId);
      if (!me) return;
      totalMatches += 1;
      totalCorrect += Math.round(me.score / 10);
      totalQuestions += c.questionCount;
    });

    labSummaries.push({ buildingId: building, totalMatches, totalCorrect, totalQuestions });
  }

  const user = await User.findById(req.userId).select('gameHistory');
  const gameHistory = user?.gameHistory || [];

  res.json({
    labs: labSummaries,
    gamingLab: {
      totalMatches: gameHistory.length,
      totalKills: gameHistory.reduce((sum, g) => sum + (g.kills || 0), 0)
    }
  });
});

router.get('/me/summary/challenges/:building', requireAuth, async (req, res) => {
  const { building } = req.params;
  const challenges = await Challenge.find({
    building, status: 'COMPLETED', 'participants.userId': req.userId
  }).select('name category difficulty questionCount participants completedAt').sort({ completedAt: -1 });

  const results = challenges.map((c) => {
    const me = c.participants.find((p) => p.userId === req.userId);
    const opponents = c.participants
      .filter((p) => p.userId !== req.userId)
      .map((p) => ({ displayName: p.displayName, score: p.score }));

    return {
      challengeId: c._id, name: c.name, category: c.category, difficulty: c.difficulty,
      questionCount: c.questionCount, yourScore: me ? me.score : 0,
      yourCorrect: me ? Math.round(me.score / 10) : 0, completedAt: c.completedAt, opponents
    };
  });

  res.json(results);
});

router.get('/me/summary/games', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('gameHistory');
  if (!user) return res.status(404).json({ error: 'user not found' });

  const history = [...(user.gameHistory || [])].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

  const results = await Promise.all(history.map(async (entry) => {
    let opponents = [];
    if (entry.matchId) {
      const match = await GameMatch.findById(entry.matchId).select('participants');
      if (match) {
        opponents = match.participants
          .filter((p) => p.userId !== req.userId)
          .map((p) => ({ displayName: p.displayName, kills: p.kills }));
      }
    }
    return { matchName: entry.matchName, kills: entry.kills, finalRank: entry.finalRank, playedAt: entry.playedAt, opponents };
  }));

  res.json(results);
});

module.exports = router;
