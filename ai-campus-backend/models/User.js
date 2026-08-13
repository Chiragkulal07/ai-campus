const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },

  // Avatar look — kept simple for now, just color choices
  avatar: {
    bodyColor: { type: String, default: 'dodgerblue' },
    hairColor: { type: String, default: 'black' },
    outfitColor: { type: String, default: 'gray' }
  },

  // Profile / progression data
  profile: {
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    challengesJoined: { type: Number, default: 0 },
    challengesWon: { type: Number, default: 0 },
    // Running total of correct answers across every completed challenge —
    // this is what's now shown instead of XP.
    totalCorrectAnswers: { type: Number, default: 0 }
  },
 gameHistory: [
    {
      matchId: String,
      matchName: String,
      kills: Number,
      finalRank: Number,
      playedAt: { type: Date, default: Date.now }
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);