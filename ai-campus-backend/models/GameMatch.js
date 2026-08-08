const mongoose = require('mongoose');

// One entry per player currently in this match's lobby/game.
const gameParticipantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  displayName: { type: String, required: true },
  kills: { type: Number, default: 0 }
}, { _id: false });

const gameMatchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  maxPlayers: { type: Number, default: 8 },
  durationSec: { type: Number, required: true }, // time limit for the match, in seconds

  status: {
    type: String,
    enum: ['OPEN_FOR_JOIN', 'IN_PROGRESS', 'COMPLETED'],
    default: 'OPEN_FOR_JOIN'
  },

  creatorId: { type: String, required: true },
  creatorName: { type: String, required: true },

  participants: [gameParticipantSchema],

  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date
});

module.exports = mongoose.model('GameMatch', gameMatchSchema);