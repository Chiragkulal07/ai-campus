const mongoose = require('mongoose');

const roadmapSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  topic: { type: String, required: true },
  followUpQuestions: [{ question: String, answer: { type: String, default: '' } }],
  status: {
    type: String,
    enum: ['collecting_answers', 'generating', 'completed', 'failed'],
    default: 'collecting_answers'
  },
  roadmap: {
    nodes: [{ id: String, label: String, description: String }],
    edges: [{ source: String, target: String }]
  },
  resources: [
    {
      nodeId: String,
      youtube: [{ title: String, url: String }],
      articles: [{ title: String, url: String }]
    }
  ],
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoadmapSession', roadmapSessionSchema);