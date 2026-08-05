const mongoose = require('mongoose');

// Each question is stored INSIDE the challenge itself, once generated —
// this means scoring is always reproducible, and we're not re-asking
// an AI "was this right?" every time someone views results later.
const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }], // exactly 4 options
  correctIndex: { type: Number, required: true } // 0-3, index into options
}, { _id: false });

// Each participant's own progress and answers live inside the challenge too.
const participantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  displayName: { type: String, required: true },
  score: { type: Number, default: 0 },
  answers: [
    {
      questionIndex: Number,
      selectedIndex: Number,
      isCorrect: Boolean,
      answeredAt: { type: Date, default: Date.now }
    }
  ]
});

const challengeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  building: {
    type: String,
    enum: ['CODING_LAB', 'INTERVIEW_HALL', 'LIBRARY', 'EVENT_HALL'],
    required: true
  },
  category: { type: String, required: true }, // e.g. "MCQ_SPRINT", "DSA_BATTLE"
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'EASY' },
  questionCount: { type: Number, required: true },
  durationPerQuestionSec: { type: Number, default: 20 },
  maxParticipants: { type: Number, default: 10 },
  visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },

  status: {
    type: String,
    enum: ['OPEN_FOR_JOIN', 'IN_PROGRESS', 'COMPLETED'],
    default: 'OPEN_FOR_JOIN'
  },

  creatorId: { type: String, required: true },
  creatorName: { type: String, required: true },

  questions: [questionSchema],
  participants: [participantSchema],

  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date
});

module.exports = mongoose.model('Challenge', challengeSchema);