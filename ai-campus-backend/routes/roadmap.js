const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const RoadmapSession = require('../models/RoadmapSession');
const { generateFollowUpQuestions, runRoadmapGraph } = require('../lib/roadmapGraph');
const { fetchResourcesForRoadmap } = require('../lib/resourceFetcher');

// POST /roadmap/start — submit a topic, get back follow-up questions
router.post('/start', requireAuth, async (req, res) => {
  const { topic } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'topic is required' });

  let questions;
  try {
    questions = await generateFollowUpQuestions(topic.trim());
  } catch (err) {
    console.error('generateFollowUpQuestions failed:', err.message);
    return res.status(502).json({ error: 'failed to generate follow-up questions, please try again' });
  }

  const session = await RoadmapSession.create({
    userId: req.userId,
    topic: topic.trim(),
    followUpQuestions: questions.map((q) => ({ question: q, answer: '' })),
    status: 'collecting_answers'
  });

  res.status(201).json({
    sessionId: session._id,
    topic: session.topic,
    questions: session.followUpQuestions.map((q) => q.question)
  });
});

// POST /roadmap/:id/answer — submit answers, get back the generated roadmap
router.post('/:id/answer', requireAuth, async (req, res) => {
  const { answers } = req.body; // array of strings, same order as the questions returned
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });

  const session = await RoadmapSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'roadmap session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'not your session' });
  if (session.status !== 'collecting_answers') {
    return res.status(400).json({ error: `session is already ${session.status}` });
  }

  session.followUpQuestions.forEach((q, i) => { q.answer = answers[i] || ''; });
  session.status = 'generating';
  await session.save();

   try {
    const roadmap = await runRoadmapGraph(session.topic, session.followUpQuestions);
    const resources = await fetchResourcesForRoadmap(roadmap.nodes);
    session.roadmap = roadmap;
    session.resources = resources;
    session.status = 'completed';
    await session.save();
    res.json({ sessionId: session._id, status: session.status, roadmap: session.roadmap, resources: session.resources });
  } catch (err) {
    console.error('runRoadmapGraph failed:', err.message);
    session.status = 'failed';
    session.errorMessage = err.message;
    await session.save();
    res.status(502).json({ error: 'failed to generate roadmap, please try again' });
  }
});

// GET /roadmap/:id — fetch one session
router.get('/:id', requireAuth, async (req, res) => {
  const session = await RoadmapSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'roadmap session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'not your session' });
  res.json(session);
});

// GET /roadmap — list current user's past roadmaps
router.get('/', requireAuth, async (req, res) => {
  const sessions = await RoadmapSession.find({ userId: req.userId })
    .select('topic status createdAt')
    .sort({ createdAt: -1 });
  res.json(sessions);
});

module.exports = router;