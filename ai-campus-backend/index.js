require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const InterviewSession = require('./models/InterviewSession');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

async function generateWithFallback(prompt) {

  // =========================================================
  // 1. GEMINI
  // =========================================================
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
    console.warn(
      '[LLM] Gemini failed:',
      geminiErr.message
    );
  }


  // =========================================================
  // 2. GEMMA - Transformer model
  // =========================================================
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
    console.warn(
      '[LLM] Gemma failed:',
      gemmaErr.message
    );
  }


  // =========================================================
  // 3. OPENROUTER
  // =========================================================
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
    console.error(
      '[LLM] OpenRouter failed:',
      openrouterErr.message
    );
  }


  // =========================================================
  // ALL LLMs FAILED
  // =========================================================
  throw new Error('All LLM providers failed');
}

const User = require('./models/User');
const requireAuth = require('./middleware/auth');
const Challenge = require('./models/Challenge');
const GameMatch = require('./models/GameMatch');
const questionBank = require('./data/questionBank');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection failed:', err.message));

// ───────────────────────────────────────────
// IN-MEMORY REAL-TIME STATE (unchanged from before)
// ───────────────────────────────────────────

const players = {};
const activeChallenges = {};
const voiceParticipants = new Set();

const ARENA_WIDTH = 1000;
const ARENA_HEIGHT = 800;
const PLAYER_RADIUS = 16;
const BATTLE_MOVE_SPEED = 5;

const WALLS = [
  { x: 400, y: 150, width: 200, height: 40 },
  { x: 150, y: 350, width: 40, height: 200 },
  { x: 810, y: 350, width: 40, height: 200 },
  { x: 400, y: 610, width: 200, height: 40 },
  { x: 480, y: 380, width: 40, height: 40 }
];

const SPAWN_POINTS = [
  { x: 80, y: 80 },
  { x: 920, y: 80 },
  { x: 80, y: 720 },
  { x: 920, y: 720 }
];

const activeBattles = {};

function isPositionBlocked(x, y) {
  for (const wall of WALLS) {
    if (
      x + PLAYER_RADIUS > wall.x &&
      x - PLAYER_RADIUS < wall.x + wall.width &&
      y + PLAYER_RADIUS > wall.y &&
      y - PLAYER_RADIUS < wall.y + wall.height
    ) {
      return true;
    }
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const BULLET_RANGE = 900;
const BULLET_STEP = 8;
const HIT_RADIUS = 18;

function raycastForHit(battle, shooter, angle) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let dist = BULLET_STEP; dist <= BULLET_RANGE; dist += BULLET_STEP) {
    const x = shooter.x + dirX * dist;
    const y = shooter.y + dirY * dist;

    if (x < 0 || x > ARENA_WIDTH || y < 0 || y > ARENA_HEIGHT) {
      return { type: 'none', point: { x, y } };
    }

    for (const wall of battle.walls) {
      if (x > wall.x && x < wall.x + wall.width && y > wall.y && y < wall.y + wall.height) {
        return { type: 'wall', point: { x, y } };
      }
    }

    for (const userId in battle.players) {
      if (userId === shooter.userId) continue;
      const target = battle.players[userId];
      if (target.hp <= 0) continue;

      const dx = x - target.x;
      const dy = y - target.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
        return { type: 'player', targetId: userId, point: { x, y } };
      }
    }
  }
  return null;
}

async function endBattle(gameId) {
  const battle = activeBattles[gameId];
  if (!battle) return;

  const finalLeaderboard = Object.values(battle.players)
    .map((p) => ({ userId: p.userId, displayName: p.displayName, kills: p.kills }))
    .sort((a, b) => b.kills - a.kills);

  io.to(`game:${gameId}`).emit('battle:match-ended', { leaderboard: finalLeaderboard });

  try {
    const match = await GameMatch.findById(gameId);
    if (match) {
      match.status = 'COMPLETED';
      match.completedAt = new Date();
      match.participants.forEach((p) => {
        const result = battle.players[p.userId];
        if (result) p.kills = result.kills;
      });
      await match.save();

      for (let rankIndex = 0; rankIndex < finalLeaderboard.length; rankIndex++) {
        const entry = finalLeaderboard[rankIndex];
        await User.findByIdAndUpdate(entry.userId, {
          $push: {
            gameHistory: {
              matchId: gameId,
              matchName: match.name,
              kills: entry.kills,
              finalRank: rankIndex + 1,
              playedAt: new Date()
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('failed to persist battle results:', err.message);
  }

  delete activeBattles[gameId];
}

function getUserIdFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    return null;
  }
}

const MOVE_SPEED = 4;

// ───────────────────────────────────────────
// SOCKET.IO — real-time events (unchanged logic from realtime.js)
// ───────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('player joined:', socket.id);

  players[socket.id] = {
    id: socket.id, x: 100, y: 100, dx: 0, dy: 0,
    displayName: 'Guest', bodyColor: 'dodgerblue'
  };

  socket.emit('world-snapshot', Object.values(players));
  socket.broadcast.emit('player-joined', players[socket.id]);

  socket.on('identify', (info) => {
    const player = players[socket.id];
    if (!player) return;
    if (info.displayName) player.displayName = info.displayName;
    if (info.bodyColor) player.bodyColor = info.bodyColor;
    io.emit('world-update', Object.values(players));
  });

  socket.on('move-input', (input) => {
    const player = players[socket.id];
    if (!player) return;
    player.dx = Math.max(-1, Math.min(1, input.dx));
    player.dy = Math.max(-1, Math.min(1, input.dy));
  });

  // Voice + video signaling
  socket.on('voice:join', () => {
    const existingParticipants = Array.from(voiceParticipants);
    voiceParticipants.add(socket.id);
    socket.emit('voice:existing-participants', existingParticipants);
    socket.to(Array.from(voiceParticipants)).emit('voice:peer-joined', { peerId: socket.id });
  });

  socket.on('voice:signal', ({ to, data }) => {
    io.to(to).emit('voice:signal', { from: socket.id, data });
  });

  socket.on('voice:leave', () => {
    voiceParticipants.delete(socket.id);
    io.emit('voice:peer-left', { peerId: socket.id });
  });

  socket.on('voice:video-stopped', () => {
    socket.broadcast.emit('voice:peer-video-stopped', { peerId: socket.id });
  });

  // Challenge engine
  socket.on('challenge:join-room', async ({ challengeId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('challenge:error', { message: 'invalid session' });

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return socket.emit('challenge:error', { message: 'challenge not found' });

    socket.join(`challenge:${challengeId}`);

    socket.emit('challenge:room-state', {
      status: challenge.status,
      name: challenge.name,
      questionCount: challenge.questionCount,
      participants: challenge.participants.map((p) => ({
        userId: p.userId, displayName: p.displayName, score: p.score
      }))
    });

    const liveState = activeChallenges[challengeId];
    if (liveState && liveState.currentQuestionIndex < liveState.questions.length) {
      const q = liveState.questions[liveState.currentQuestionIndex];
      socket.emit('challenge:question', {
        questionIndex: liveState.currentQuestionIndex,
        totalQuestions: liveState.questions.length,
        questionText: q.questionText,
        options: q.options,
        durationSec: liveState.durationSec
      });
    }
  });

  socket.on('challenge:start', async ({ challengeId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('challenge:error', { message: 'invalid session' });

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return socket.emit('challenge:error', { message: 'challenge not found' });

    if (challenge.creatorId !== userId) {
      return socket.emit('challenge:error', { message: 'only the creator can start this challenge' });
    }
    if (challenge.status !== 'OPEN_FOR_JOIN') {
      return socket.emit('challenge:error', { message: 'this challenge already started or finished' });
    }

    challenge.status = 'IN_PROGRESS';
    challenge.startedAt = new Date();
    await challenge.save();

    const participantState = {};
    challenge.participants.forEach((p) => {
      participantState[p.userId] = { displayName: p.displayName, score: 0, answeredThisQuestion: false };
    });

    activeChallenges[challengeId] = {
      questions: challenge.questions,
      durationSec: challenge.durationPerQuestionSec,
      currentQuestionIndex: 0,
      participants: participantState,
      timer: null
    };

    io.to(`challenge:${challengeId}`).emit('challenge:started');
    startNextQuestion(challengeId);
  });

  socket.on('challenge:answer', async ({ challengeId, questionIndex, selectedIndex, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('challenge:error', { message: 'invalid session' });

    const state = activeChallenges[challengeId];
    if (!state) return socket.emit('challenge:error', { message: 'this challenge is not active' });

    const participant = state.participants[userId];
    if (!participant) return socket.emit('challenge:error', { message: 'you are not part of this challenge' });

    if (questionIndex !== state.currentQuestionIndex) return;
    if (participant.answeredThisQuestion) return;

    const correctIndex = state.questions[questionIndex].correctIndex;
    const isCorrect = selectedIndex === correctIndex;

    if (isCorrect) participant.score += 10;
    participant.answeredThisQuestion = true;

    const allAnswered = Object.values(state.participants).every((p) => p.answeredThisQuestion);
    if (allAnswered) {
      clearTimeout(state.timer);
      revealAndAdvance(challengeId);
    }
  });

  // Gaming Lab
  socket.on('game:watch-lobby', ({ gameId }) => {
    socket.join(`game:${gameId}`);
  });

  socket.on('game:start', async ({ gameId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('game:error', { message: 'invalid session' });

    const match = await GameMatch.findById(gameId);
    if (!match) return socket.emit('game:error', { message: 'game not found' });

    if (match.creatorId !== userId) {
      return socket.emit('game:error', { message: 'only the creator can start this game' });
    }
    if (match.status !== 'OPEN_FOR_JOIN') {
      return socket.emit('game:error', { message: 'this game already started or finished' });
    }

    match.status = 'IN_PROGRESS';
    match.startedAt = new Date();
    await match.save();

    const battlePlayers = {};
    match.participants.forEach((p, index) => {
      const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length];
      battlePlayers[p.userId] = {
        userId: p.userId, displayName: p.displayName,
        x: spawn.x, y: spawn.y, dx: 0, dy: 0,
        hp: 100, kills: 0, socketId: null
      };
    });

    activeBattles[gameId] = {
      walls: WALLS, players: battlePlayers,
      durationSec: match.durationSec,
      endsAt: Date.now() + match.durationSec * 1000,
      endTimer: null
    };

    activeBattles[gameId].endTimer = setTimeout(() => endBattle(gameId), match.durationSec * 1000);

    io.to(`game:${gameId}`).emit('game:started', {
      walls: WALLS, arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT, durationSec: match.durationSec
    });
  });

  socket.on('battle:join-room', async ({ gameId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('game:error', { message: 'invalid session' });

    socket.join(`game:${gameId}`);

    const battle = activeBattles[gameId];
    if (!battle) return socket.emit('game:error', { message: 'this battle has not started yet' });

    const playerState = battle.players[userId];
    if (!playerState) return socket.emit('game:error', { message: 'you are not part of this game' });

    playerState.socketId = socket.id;

    socket.emit('battle:room-state', {
      walls: battle.walls, arenaWidth: ARENA_WIDTH, arenaHeight: ARENA_HEIGHT,
      players: Object.values(battle.players).map((p) => ({
        userId: p.userId, displayName: p.displayName, x: p.x, y: p.y, hp: p.hp, kills: p.kills
      })),
      msRemaining: Math.max(0, battle.endsAt - Date.now())
    });
  });

  socket.on('battle:move-input', ({ gameId, token, dx, dy }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return;
    const battle = activeBattles[gameId];
    if (!battle) return;
    const playerState = battle.players[userId];
    if (!playerState) return;
    playerState.dx = Math.max(-1, Math.min(1, dx));
    playerState.dy = Math.max(-1, Math.min(1, dy));
  });

  socket.on('battle:fire', ({ gameId, token, angle }) => {
    const shooterId = getUserIdFromToken(token);
    if (!shooterId) return;
    const battle = activeBattles[gameId];
    if (!battle) return;
    const shooter = battle.players[shooterId];
    if (!shooter || shooter.hp <= 0) return;

    const hitResult = raycastForHit(battle, shooter, angle);

    io.to(`game:${gameId}`).emit('battle:shot-fired', {
      shooterId, angle, hitPoint: hitResult ? hitResult.point : null
    });

    if (hitResult && hitResult.type === 'player') {
      const target = battle.players[hitResult.targetId];
      if (!target || target.hp <= 0) return;

      target.hp = Math.max(0, target.hp - 20);

      if (target.hp === 0) {
        shooter.kills += 1;
        io.to(`game:${gameId}`).emit('battle:kill', {
          killerId: shooterId, killerName: shooter.displayName,
          victimId: target.userId, victimName: target.displayName,
          killerKills: shooter.kills
        });

        setTimeout(() => {
          const stillActive = activeBattles[gameId];
          if (!stillActive) return;
          const respawning = stillActive.players[target.userId];
          if (!respawning) return;
          const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
          respawning.x = spawn.x;
          respawning.y = spawn.y;
          respawning.hp = 100;
          io.to(`game:${gameId}`).emit('battle:respawn', {
            userId: respawning.userId, x: respawning.x, y: respawning.y
          });
        }, 3000);
      } else {
        io.to(`game:${gameId}`).emit('battle:hit', {
          targetId: target.userId, newHp: target.hp, shooterId
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('player left:', socket.id);
    delete players[socket.id];
    io.emit('player-left', socket.id);

    if (voiceParticipants.has(socket.id)) {
      voiceParticipants.delete(socket.id);
      io.emit('voice:peer-left', { peerId: socket.id });
    }
  });
});

setInterval(() => {
  let somethingMoved = false;
  for (const id in players) {
    const player = players[id];
    if (player.dx !== 0 || player.dy !== 0) {
      player.x += player.dx * MOVE_SPEED;
      player.y += player.dy * MOVE_SPEED;
      somethingMoved = true;
    }
  }
  if (somethingMoved) io.emit('world-update', Object.values(players));
}, 100);

setInterval(() => {
  for (const gameId in activeBattles) {
    const battle = activeBattles[gameId];
    let somethingMoved = false;

    for (const userId in battle.players) {
      const p = battle.players[userId];
      if (p.dx === 0 && p.dy === 0) continue;

      let nextX = p.x, nextY = p.y;

      if (p.dx !== 0) {
        const testX = clamp(p.x + p.dx * BATTLE_MOVE_SPEED, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
        if (!isPositionBlocked(testX, p.y)) nextX = testX;
      }
      if (p.dy !== 0) {
        const testY = clamp(p.y + p.dy * BATTLE_MOVE_SPEED, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
        if (!isPositionBlocked(nextX, testY)) nextY = testY;
      }

      p.x = nextX; p.y = nextY;
      somethingMoved = true;
    }

    if (somethingMoved) {
      io.to(`game:${gameId}`).emit('battle:update', {
        players: Object.values(battle.players).map((p) => ({
          userId: p.userId, displayName: p.displayName, x: p.x, y: p.y, hp: p.hp, kills: p.kills
        })),
        msRemaining: Math.max(0, battle.endsAt - Date.now())
      });
    }
  }
}, 100);

function startNextQuestion(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;
  if (state.currentQuestionIndex >= state.questions.length) return finishChallenge(challengeId);

  Object.values(state.participants).forEach((p) => { p.answeredThisQuestion = false; });
  const q = state.questions[state.currentQuestionIndex];

  io.to(`challenge:${challengeId}`).emit('challenge:question', {
    questionIndex: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
    questionText: q.questionText,
    options: q.options,
    durationSec: state.durationSec
  });

  state.timer = setTimeout(() => revealAndAdvance(challengeId), state.durationSec * 1000);
}

function revealAndAdvance(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;
  const q = state.questions[state.currentQuestionIndex];

  const leaderboard = Object.entries(state.participants)
    .map(([userId, p]) => ({ userId, displayName: p.displayName, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.to(`challenge:${challengeId}`).emit('challenge:reveal', {
    questionIndex: state.currentQuestionIndex,
    correctIndex: q.correctIndex,
    leaderboard
  });

  state.currentQuestionIndex += 1;
  setTimeout(() => startNextQuestion(challengeId), 3000);
}

async function finishChallenge(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;

  const finalLeaderboard = Object.entries(state.participants)
    .map(([userId, p]) => ({ userId, displayName: p.displayName, score: p.score }))
    .sort((a, b) => b.score - a.score);

  const challenge = await Challenge.findById(challengeId);
  if (challenge) {
    challenge.status = 'COMPLETED';
    challenge.completedAt = new Date();
    challenge.participants.forEach((p) => {
      const result = state.participants[p.userId];
      if (result) p.score = result.score;
    });
    await challenge.save();
  }

  io.to(`challenge:${challengeId}`).emit('challenge:completed', { leaderboard: finalLeaderboard });
  delete activeChallenges[challengeId];
}

// ───────────────────────────────────────────
// REST ROUTES (unchanged logic from index.js — internalSocket bridge removed,
// broadcasts now go directly through io.emit since it's the same process)
// ───────────────────────────────────────────

app.post('/auth/signup', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password and displayName are all required' });
  }
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'an account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, displayName });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'invalid email or password' });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
});

app.post('/games', requireAuth, async (req, res) => {
  const { name, maxPlayers, durationSec } = req.body;
  if (!name || !durationSec) return res.status(400).json({ error: 'name and durationSec are required' });

  const creator = await User.findById(req.userId);
  if (!creator) return res.status(404).json({ error: 'creator user not found' });

  const match = await GameMatch.create({
    name, maxPlayers: maxPlayers || 8, durationSec,
    creatorId: req.userId, creatorName: creator.displayName
  });

  io.emit('game:created', {
    id: match._id, name: match.name, maxPlayers: match.maxPlayers,
    durationSec: match.durationSec, currentParticipants: 0,
    creatorName: match.creatorName, status: match.status
  });

  res.status(201).json({
    id: match._id, name: match.name, maxPlayers: match.maxPlayers,
    durationSec: match.durationSec, status: match.status, creatorName: match.creatorName
  });
});

app.get('/games', async (req, res) => {
  const matches = await GameMatch.find({ status: 'OPEN_FOR_JOIN' })
    .select('name maxPlayers durationSec participants creatorName status createdAt')
    .sort({ createdAt: -1 });

  res.json(matches.map((m) => ({
    id: m._id, name: m.name, maxPlayers: m.maxPlayers, durationSec: m.durationSec,
    currentParticipants: m.participants.length, creatorName: m.creatorName, status: m.status
  })));
});


// Given resume text, generate interview questions via the fallback-protected LLM.
// If BOTH Gemini and OpenRouter fail, we fall back to a small set of safe
// generic questions so this feature never hard-crashes for the user.
const GENERIC_FALLBACK_QUESTIONS = [
  "Tell me about a project you're most proud of and what your specific role was.",
  "Describe a challenging technical problem you faced and how you solved it.",
  "What technologies are you most comfortable with, and why?",
  "How do you approach learning a new tool or technology?",
  "Where do you see yourself applying these skills professionally?"
];

app.post('/interview/generate-questions', requireAuth, async (req, res) => {
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

    // The model sometimes wraps JSON in markdown code fences despite instructions — strip those defensively
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

app.post('/games/:id/join', requireAuth, async (req, res) => {
  const match = await GameMatch.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'game not found' });
  if (match.status !== 'OPEN_FOR_JOIN') return res.status(400).json({ error: 'this game is no longer open to join' });
  if (match.participants.length >= match.maxPlayers) return res.status(400).json({ error: 'this game is full' });

  const alreadyJoined = match.participants.some((p) => p.userId === req.userId);
  if (alreadyJoined) return res.status(409).json({ error: 'you already joined this game' });

  const user = await User.findById(req.userId);
  match.participants.push({ userId: req.userId, displayName: user.displayName, kills: 0 });
  await match.save();

  res.json({ id: match._id, participants: match.participants.map((p) => ({ userId: p.userId, displayName: p.displayName })) });
});

app.get('/games/:id', requireAuth, async (req, res) => {
  const match = await GameMatch.findById(req.params.id);
  if (!match) return res.status(404).json({ error: 'game not found' });
  res.json(match);
});

app.get('/profile/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ id: user._id, email: user.email, displayName: user.displayName, avatar: user.avatar, profile: user.profile });
});

app.post('/challenges', requireAuth, async (req, res) => {
  const { name, building, category, difficulty, questionCount, maxParticipants } = req.body;
  if (!name || !building || !category || !questionCount) {
    return res.status(400).json({ error: 'name, building, category and questionCount are required' });
  }

  const creator = await User.findById(req.userId);
  if (!creator) return res.status(404).json({ error: 'creator user not found' });

  const shuffled = [...questionBank].sort(() => Math.random() - 0.5);
  const selectedQuestions = shuffled.slice(0, Math.min(questionCount, questionBank.length));

  const challenge = await Challenge.create({
    name, building, category, difficulty: difficulty || 'EASY',
    questionCount: selectedQuestions.length, maxParticipants: maxParticipants || 10,
    creatorId: req.userId, creatorName: creator.displayName, questions: selectedQuestions
  });

  io.emit('challenge:created', {
    id: challenge._id, name: challenge.name, building: challenge.building,
    category: challenge.category, difficulty: challenge.difficulty,
    questionCount: challenge.questionCount, maxParticipants: challenge.maxParticipants,
    currentParticipants: 0, creatorName: challenge.creatorName, status: challenge.status
  });

  res.status(201).json({
    id: challenge._id, name: challenge.name, building: challenge.building,
    category: challenge.category, difficulty: challenge.difficulty,
    questionCount: challenge.questionCount, maxParticipants: challenge.maxParticipants,
    status: challenge.status, creatorName: challenge.creatorName
  });
});

app.get('/challenges', async (req, res) => {
  const filter = { visibility: 'PUBLIC', status: 'OPEN_FOR_JOIN' };
  if (req.query.building) filter.building = req.query.building;

  const challenges = await Challenge.find(filter)
    .select('name building category difficulty questionCount maxParticipants participants creatorName status createdAt')
    .sort({ createdAt: -1 });

  res.json(challenges.map((c) => ({
    id: c._id, name: c.name, building: c.building, category: c.category,
    difficulty: c.difficulty, questionCount: c.questionCount, maxParticipants: c.maxParticipants,
    currentParticipants: c.participants.length, creatorName: c.creatorName, status: c.status
  })));
});

app.post('/challenges/:id/join', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'challenge not found' });
  if (challenge.status !== 'OPEN_FOR_JOIN') return res.status(400).json({ error: 'this challenge is no longer open to join' });
  if (challenge.participants.length >= challenge.maxParticipants) return res.status(400).json({ error: 'this challenge is full' });

  const alreadyJoined = challenge.participants.some((p) => p.userId === req.userId);
  if (alreadyJoined) return res.status(409).json({ error: 'you already joined this challenge' });

  const user = await User.findById(req.userId);
  challenge.participants.push({ userId: req.userId, displayName: user.displayName, score: 0, answers: [] });
  await challenge.save();

  user.profile.challengesJoined += 1;
  await user.save();

  res.json({ id: challenge._id, participants: challenge.participants.map((p) => ({ userId: p.userId, displayName: p.displayName })) });
});

app.get('/challenges/:id', requireAuth, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'challenge not found' });
  res.json(challenge);
});

// Upload a resume PDF and get back the extracted plain text.
// Nothing is saved to the database yet — this route just proves extraction
// works correctly before any LLM is involved.
app.post('/interview/upload-resume', requireAuth, upload.single('resume'), async (req, res) => {
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


// Start a real session — stores the resume + generated questions, so the
// user can now answer them one at a time and we can score everything later.
app.post('/interview/start-session', requireAuth, async (req, res) => {
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

// Submit an answer to the current question, get back the next one
// (or a signal that all questions are done and it's ready to be scored).
app.post('/interview/session/:id/answer', requireAuth, async (req, res) => {
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

// Get the current state of a session — used if the user refreshes the page mid-interview
app.get('/interview/session/:id', requireAuth, async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });

  res.json(session);
});

app.put('/profile/avatar', requireAuth, async (req, res) => {
  const { bodyColor, hairColor, outfitColor } = req.body;
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  if (bodyColor) user.avatar.bodyColor = bodyColor;
  if (hairColor) user.avatar.hairColor = hairColor;
  if (outfitColor) user.avatar.outfitColor = outfitColor;

  await user.save();
  res.json({ avatar: user.avatar });
});

app.get('/profile/me/games', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('gameHistory');
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json(user.gameHistory || []);
});

app.get('/profile/me/summary', requireAuth, async (req, res) => {
  const buildings = ['CODING_LAB', 'INTERVIEW_HALL', 'LIBRARY', 'EVENT_HALL'];
  const labSummaries = [];

  for (const building of buildings) {
    const challenges = await Challenge.find({
      building, status: 'COMPLETED', 'participants.userId': req.userId
    }).select('participants questionCount');

    let totalMatches = 0, totalCorrect = 0, totalQuestions = 0;

    challenges.forEach((c) => {
      const me = c.participants.find((p) => p.userId === req.userId);
      if (!me) return;
      totalMatches += 1;
      totalCorrect += Math.round(me.score / 10);
      totalQuestions += c.questionCount;
    });

    labSummaries.push({ buildingId: building, totalMatches, totalCorrect, totalQuestions });
  }

  const user = await User.findById(req.userId).select('gameHistory');
  const gameHistory = user?.gameHistory || [];

  res.json({
    labs: labSummaries,
    gamingLab: {
      totalMatches: gameHistory.length,
      totalKills: gameHistory.reduce((sum, g) => sum + (g.kills || 0), 0)
    }
  });
});

// Score the whole interview, suggest roles, and give improvement feedback —
// same fallback-protected LLM call as question generation.
app.post('/interview/session/:id/finish', requireAuth, async (req, res) => {
  const session = await InterviewSession.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.userId !== req.userId) return res.status(403).json({ error: 'this is not your session' });
  if (session.status === 'COMPLETED') return res.json(session); // idempotent — already scored

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
      score: Math.round(session.questions.length * 6), // a neutral middle-ish score, not a zero
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

app.get('/profile/me/summary/challenges/:building', requireAuth, async (req, res) => {
  const { building } = req.params;
  const challenges = await Challenge.find({
    building, status: 'COMPLETED', 'participants.userId': req.userId
  }).select('name category difficulty questionCount participants completedAt').sort({ completedAt: -1 });

  const results = challenges.map((c) => {
    const me = c.participants.find((p) => p.userId === req.userId);
    const opponents = c.participants
      .filter((p) => p.userId !== req.userId)
      .map((p) => ({ displayName: p.displayName, score: p.score }));

    return {
      challengeId: c._id, name: c.name, category: c.category, difficulty: c.difficulty,
      questionCount: c.questionCount, yourScore: me ? me.score : 0,
      yourCorrect: me ? Math.round(me.score / 10) : 0, completedAt: c.completedAt, opponents
    };
  });

  res.json(results);
});

app.get('/profile/me/summary/games', requireAuth, async (req, res) => {
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

app.get('/labs', (req, res) => {
  res.json([
    { id: 'CODING_LAB', name: 'Coding Lab', description: 'DSA, SQL, MCQ and code challenges', mapConfig: { x: 400, y: 300, color: '#188c88' } },
    { id: 'INTERVIEW_HALL', name: 'Interview Hall', description: 'Mock interviews and resume review', mapConfig: { x: 800, y: 300, color: '#5c4535' } },
    { id: 'LIBRARY', name: 'Library', description: 'Document Q&A and research challenges', mapConfig: { x: 400, y: 700, color: '#b08154' } },
    { id: 'EVENT_HALL', name: 'Event Hall', description: 'Hackathons and community events', mapConfig: { x: 800, y: 700, color: '#de9b2a' } }
  ]);
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`server running on port ${PORT} (REST + Socket.IO combined)`));