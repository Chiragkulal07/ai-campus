const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const GameMatch = require('../models/GameMatch');
const { computeProgress } = require('../lib/progress');

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  // Level/XP are derived from real match history rather than the stored defaults.
  const progress = computeProgress(user.gameHistory);
  const stored = user.profile?.toObject ? user.profile.toObject() : (user.profile || {});
  res.json({
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar,
    profile: {
      ...stored,
      level: progress.level,
      xp: progress.xp,
      xpIntoLevel: progress.xpIntoLevel,
      xpPerLevel: progress.xpPerLevel,
    },
  });
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
  const user = await User.findById(req.userId).select('gameHistory');
  if (!user) return res.status(404).json({ error: 'user not found' });
  const p = computeProgress(user.gameHistory || []);

  res.json({
    progress: { level: p.level, xp: p.xp, xpIntoLevel: p.xpIntoLevel, xpPerLevel: p.xpPerLevel },
    gamingLab: {
      totalMatches: p.totalMatches,
      totalKills: p.totalKills,
      wins: p.wins,
      podiums: p.podiums,
      bestKills: p.bestKills,
      winRate: p.winRate,
      avgKills: p.avgKills,
    },
  });
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
