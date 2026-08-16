const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  questionText: String,
  answerText: String,
  answeredAt: { type: Date, default: Date.now }
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  resumeText: { type: String, required: true },
  questions: [{ type: String, required: true }],
  answers: [answerSchema],

  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'IN_PROGRESS'
  },

  // Filled in only once status becomes COMPLETED (Phase 4)
  score: Number,
  maxScore: Number,
  roleSuggestions: [String],
  improvementAreas: [String],
  overallFeedback: String,

  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);