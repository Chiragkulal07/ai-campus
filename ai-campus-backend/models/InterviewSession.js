const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  questionText: String,
  answerText: String,
  answeredAt: { type: Date, default: Date.now }
}, { _id: false });

const jobResultSchema = new mongoose.Schema({
  title: String,
  url: String,
  snippet: String
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  resumeText: { type: String, required: true },

  // Filled in by the resume analysis graph (analyze_resume node)
  extractedSkills: [String],
  extractedProjects: [String],

  // Filled in by the resume analysis graph (search_jobs node, runs in parallel with questions)
  jobSearchResults: [jobResultSchema],

  questions: [{ type: String, required: true }],
  answers: [answerSchema],

  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'IN_PROGRESS'
  },

  // Filled in only once status becomes COMPLETED, by the recommendation graph
  score: Number,
  maxScore: Number,
  targetRole: String,
  matchingCompanies: [String],
  improvementAreas: [String],
  overallFeedback: String,
  llmSource: String,

  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);