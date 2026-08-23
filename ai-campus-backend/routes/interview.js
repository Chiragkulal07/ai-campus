const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const requireAuth = require('../middleware/auth');
const InterviewSession = require('../models/InterviewSession');
const { runResumeAnalysis, runRecommendations } = require('../lib/interviewGraph');

const upload = multer({ storage: multer.memoryStorage() });

const GENERIC_FALLBACK_QUESTIONS = [
  "Tell me about a project you're most proud of and what your specific role was.",
  "Describe a challenging technical problem you faced and how you solved it.",
  "What technologies are you most comfortable with, and why?",
  "How do you approach learning a new tool or technology?",
  "Where do you see yourself applying these skills professionally?"
];

// ── Upload: now supports both PDF and DOCX ──
router.post('/upload-resume', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'no resume file was uploaded' });
  }

  try {
    let resumeText = '';
    const isDocx = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || req.file.originalname.toLowerCase().endsWith('.docx');

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      resumeText = result.value.trim();
    } else {
      const parsed = await pdfParse(req.file.buffer);
      resumeText = parsed.text.trim();
    }

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: 'could not extract meaningful text from this file — try a different one' });
    }

    res.json({ resumeText, characterCount: resumeText.length });
  } catch (err) {
    console.error('resume parsing failed:', err);
    res.status(500).json({ error: 'failed to parse the resume file', detail: err.message });
  }
});

// ── Analyze resume + generate questions + search jobs (parallel, via LangGraph) ──
router.post('/generate-questions', requireAuth, async (req, res) => {
  const { resumeText, questionCount } = req.body;

  if (!resumeText || resumeText.length < 50) {
    return res.status(400).json({ error: 'resumeText is required and must be substantial' });
  }

  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 5);

  try {
    const result = await runResumeAnalysis(resumeText, count);

    res.json({
      questions: result.questions,
      extractedSkills: result.extractedSkills,
      extractedProjects: result.extractedProjects,
      jobSearchResults: result.jobSearchResults,
      source: result.llmSource
    });
  } catch (err) {
    console.error('[interview] resume analysis fully failed, using generic fallback:', err.message);
    res.json({
      questions: GENERIC_FALLBACK_QUESTIONS.slice(0, count),
      extractedSkills: [],
      extractedProjects: [],
      jobSearchResults: [],
      source: 'generic-fallback'
    });
  }
});

// ── Start session — now also stores the extracted skills/projects/job results ──
router.post('/start-session', requireAuth, async (req, res) => {
  const { resumeText, questions, extractedSkills, extractedProjects, jobSearchResults } = req.body;

  if (!resumeText || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'resumeText and a non-empty questions array are required' });
  }

  const session = await InterviewSession.create({
    userId: req.userId,
    resumeText,
    questions,
    answers: [],
    status: 'IN_PROGRESS',
    extractedSkills: Array.isArray(extractedSkills) ? extractedSkills : [],
    extractedProjects: Array.isArray(extractedProjects) ? extractedProjects : [],
    jobSearchResults: Array.isArray(jobSearchResults) ? jobSearchResults : []
  });

  res.status(201).json({
    sessionId: session._id,
    totalQuestions: questions.length,
    currentQuestionIndex: 0,
    currentQuestion: questions[0]
  });
});

router.post('/session/:id/answer', requireAuth, async (req, res) => {
  const { answerText } = req.body;

  if (!answerText || !answerText.trim()) {
    return res.status(400).json({ error: 'answerText is required' });
  }

  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });
  if (session.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'this session is already completed' });

  const nextIndex = session.answers.length;
  if (nextIndex >= session.questions.length) {
    return res.status(400).json({ error: 'all questions already answered' });
  }

  session.answers.push({
    questionIndex: nextIndex,
    questionText: session.questions[nextIndex],
    answerText: answerText.trim()
  });
  await session.save();

  const isLastQuestion = session.answers.length >= session.questions.length;

  res.json({
    sessionId: session._id,
    totalQuestions: session.questions.length,
    currentQuestionIndex: session.answers.length,
    currentQuestion: isLastQuestion ? null : session.questions[session.answers.length],
    readyToFinish: isLastQuestion
  });
});

router.get('/session/:id', requireAuth, async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });

  res.json(session);
});

// ── Finish: runs the recommendation graph (sequential — needs quiz answers + job results) ──
router.post('/session/:id/finish', requireAuth, async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });
  if (session.status === 'COMPLETED') return res.json(session);

  if (session.answers.length < session.questions.length) {
    return res.status(400).json({ error: 'not all questions have been answered yet' });
  }

  const quizAnswers = session.answers.map((a) => ({ question: a.questionText, answer: a.answerText }));

  let result;
  try {
    result = await runRecommendations({
      extractedSkills: session.extractedSkills,
      extractedProjects: session.extractedProjects,
      jobSearchResults: session.jobSearchResults,
      quizAnswers
    });
  } catch (err) {
    console.error('[interview] recommendations fully failed, using generic fallback:', err.message);
    result = {
      recommendations: {
        score: Math.round(session.questions.length * 6),
        targetRole: 'Software Engineer',
        matchingCompanies: ['Various tech companies matching your skillset'],
        improvementAreas: [
          'Practice giving more specific, detailed examples in your answers',
          'Structure answers with a clear situation, action, and result'
        ],
        overallFeedback: 'We could not generate detailed AI feedback right now, but your answers have been saved. Please try finishing this session again shortly.'
      }
    };
  }

  const rec = result.recommendations;

  session.status = 'COMPLETED';
  session.completedAt = new Date();
  session.score = rec.score;
  session.maxScore = session.questions.length * 10;
  session.targetRole = rec.targetRole;
  session.improvementAreas = rec.improvementAreas || [];
  session.overallFeedback = rec.overallFeedback || '';
  await session.save();

  res.json(session);
});

module.exports = router;