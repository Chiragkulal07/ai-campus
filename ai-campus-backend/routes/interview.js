const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const requireAuth = require('../middleware/auth');
const InterviewSession = require('../models/InterviewSession');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const upload = multer({ storage: multer.memoryStorage() });

async function generateWithFallback(prompt) {
  // 1. GEMINI
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash'
    });
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      source: 'gemini-3.5-flash'
    };
  } catch (geminiErr) {
    console.warn('[LLM] Gemini failed:', geminiErr.message);
  }

  // 2. GEMMA - Transformer model
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemma-4-31b-it'
    });
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      source: 'gemma-4-31b-it'
    };
  } catch (gemmaErr) {
    console.warn('[LLM] Gemma failed:', gemmaErr.message);
  }

  // 3. OPENROUTER
  try {
    const completion = await openrouter.chat.completions.create({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    return {
      text: completion.choices[0].message.content,
      source: 'openrouter-llama'
    };
  } catch (openrouterErr) {
    console.error('[LLM] OpenRouter failed:', openrouterErr.message);
  }

  throw new Error('All LLM providers failed');
}

const GENERIC_FALLBACK_QUESTIONS = [
  "Tell me about a project you're most proud of and what your specific role was.",
  "Describe a challenging technical problem you faced and how you solved it.",
  "What technologies are you most comfortable with, and why?",
  "How do you approach learning a new tool or technology?",
  "Where do you see yourself applying these skills professionally?"
];

router.post('/generate-questions', requireAuth, async (req, res) => {
  const { resumeText, questionCount } = req.body;

  if (!resumeText || resumeText.length < 50) {
    return res.status(400).json({ error: 'resumeText is required and must be substantial' });
  }

  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 10);

  const prompt = `You are an experienced technical interviewer. Based on the following resume, generate exactly ${count} interview questions.

Rules:
- Questions should be specific to what's actually in the resume (projects, skills, experience mentioned) — not generic
- Mix technical and behavioral questions where appropriate
- Return ONLY a JSON array of strings, nothing else, no markdown formatting, no explanation
- Example format: ["Question one?", "Question two?"]

Resume:
${resumeText}`;

  try {
    const { text, source } = await generateWithFallback(prompt);

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error('LLM did not return valid JSON');
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('LLM returned an empty or invalid question list');
    }

    res.json({ questions: questions.slice(0, count), source });
  } catch (err) {
    console.error('[interview] question generation fully failed, using generic fallback:', err.message);
    res.json({ questions: GENERIC_FALLBACK_QUESTIONS.slice(0, count), source: 'generic-fallback' });
  }
});

router.post('/upload-resume', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'no resume file was uploaded' });
  }

  try {
    const parsed = await pdfParse(req.file.buffer);
    const resumeText = parsed.text.trim();

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: 'could not extract meaningful text from this PDF — try a different file' });
    }

    res.json({
      resumeText,
      characterCount: resumeText.length
    });
  } catch (err) {
    console.error('resume parsing failed — FULL ERROR:', err);
    res.status(500).json({ error: 'failed to parse the PDF file', detail: err.message });
  }
});

router.post('/start-session', requireAuth, async (req, res) => {
  const { resumeText, questions } = req.body;

  if (!resumeText || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'resumeText and a non-empty questions array are required' });
  }

  const session = await InterviewSession.create({
    userId: req.userId,
    resumeText,
    questions,
    answers: [],
    status: 'IN_PROGRESS'
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

router.post('/session/:id/finish', requireAuth, async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });
  if (session.status === 'COMPLETED') return res.json(session);

  if (session.answers.length < session.questions.length) {
    return res.status(400).json({ error: 'not all questions have been answered yet' });
  }

  const qaPairs = session.answers
    .map((a, i) => `Q${i + 1}: ${a.questionText}\nA${i + 1}: ${a.answerText}`)
    .join('\n\n');

  const prompt = `You are an experienced technical interviewer evaluating a candidate.

Resume:
${session.resumeText}

Interview Q&A:
${qaPairs}

Evaluate this interview and respond with ONLY a JSON object (no markdown, no explanation) in exactly this shape:
{
  "score": <number out of ${session.questions.length * 10}, based on answer quality/depth/relevance>,
  "roleSuggestions": [<2-4 job role titles this person could realistically apply for, based on resume + answers>],
  "improvementAreas": [<2-4 short, specific, actionable improvement suggestions>],
  "overallFeedback": "<2-3 sentence overall summary of how the interview went>"
}`;

  let result;
  try {
    const { text } = await generateWithFallback(prompt);
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    result = JSON.parse(cleaned);

    if (typeof result.score !== 'number' || !Array.isArray(result.roleSuggestions)) {
      throw new Error('LLM returned an unexpected shape');
    }
  } catch (err) {
    console.error('[interview] scoring fully failed, using generic fallback:', err.message);
    result = {
      score: Math.round(session.questions.length * 6),
      roleSuggestions: ['Software Engineer', 'Full Stack Developer'],
      improvementAreas: [
        'Practice giving more specific, detailed examples in your answers',
        'Structure answers with a clear situation, action, and result'
      ],
      overallFeedback: 'We could not generate detailed AI feedback right now, but your answers have been saved. Please try finishing this session again shortly.'
    };
  }

  session.status = 'COMPLETED';
  session.completedAt = new Date();
  session.score = result.score;
  session.maxScore = session.questions.length * 10;
  session.roleSuggestions = result.roleSuggestions;
  session.improvementAreas = result.improvementAreas || [];
  session.overallFeedback = result.overallFeedback || '';
  await session.save();

  res.json(session);
});

module.exports = router;
