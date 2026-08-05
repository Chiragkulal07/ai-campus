require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Challenge = require('./models/Challenge');
const User = require('./models/User');
const { createServer } = require('http');
const { Server } = require('socket.io');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('realtime-server connected to MongoDB'))
  .catch((err) => console.error('realtime-server MongoDB connection failed:', err.message));

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// All live player positions stay here, in memory — never in MongoDB.
// Key = socket id, Value = that player's current state.
const players = {};

// Live state for challenges currently in progress, keyed by challengeId.
// This is intentionally NOT the same as the `players` object above —
// movement state and challenge state are separate concerns.
const activeChallenges = {};

// Who currently has their mic "on" and is part of the global voice mesh.
// Just a set of socket ids — no audio ever passes through this server,
// it only relays tiny WebRTC handshake messages between peers.
const voiceParticipants = new Set();

// Small helper — verifies a token and returns the userId, or null if invalid
function getUserIdFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    return null;
  }
}

const MOVE_SPEED = 4; // how far a player moves per tick, kept small so it's easy to read in logs

io.on('connection', (socket) => {
  console.log('player joined:', socket.id);

  // New player starts at a fixed spot, with placeholder identity until "identify" arrives
  players[socket.id] = {
    id: socket.id,
    x: 100,
    y: 100,
    dx: 0,
    dy: 0,
    displayName: 'Guest',
    bodyColor: 'dodgerblue'
  };

  // Send the new player the full current world state, so they see everyone already there
  socket.emit('world-snapshot', Object.values(players));

  // Let everyone else know someone new joined
  socket.broadcast.emit('player-joined', players[socket.id]);

  // Client sends their real name/color right after connecting (or after changing avatar)
  socket.on('identify', (info) => {
    const player = players[socket.id];
    if (!player) return;

    if (info.displayName) player.displayName = info.displayName;
    if (info.bodyColor) player.bodyColor = info.bodyColor;

    // Broadcast the update so everyone sees the real name/color immediately
    io.emit('world-update', Object.values(players));
  });

  // Any screen (not just the challenge room) can call this with the user's
  // JWT to subscribe to live profile stat updates — e.g. Reception, so its
  // "correct answers" count updates the moment a challenge finishes even
  // if the user already backed out of the challenge screen.
  socket.on('user:register', ({ token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return;
    socket.join(`user:${userId}`);
    socket.data.userId = userId;
  });

  // The client only ever tells us direction intent — never a position directly.
  // This is what stops a player from just claiming to teleport anywhere.
  socket.on('move-input', (input) => {
    const player = players[socket.id];
    if (!player) return;

    player.dx = Math.max(-1, Math.min(1, input.dx));
    player.dy = Math.max(-1, Math.min(1, input.dy));
  });

  // ───────────────────────────────────────────
  // VOICE CHAT SIGNALING (global, WebRTC mesh)
  // This server never sees or touches actual audio — it only relays small
  // text handshake messages so two browsers can find each other and then
  // stream audio directly, peer-to-peer.
  // ───────────────────────────────────────────

  // A player turns their mic on — tell everyone currently in voice about this
  // new peer, and tell the new peer who's already in voice, so both sides
  // know who they need to connect to.
  socket.on('voice:join', () => {
    const existingParticipants = Array.from(voiceParticipants);
    voiceParticipants.add(socket.id);

    // Tell the new peer who is already talking, so they can initiate connections
    socket.emit('voice:existing-participants', existingParticipants);

    // Tell everyone already in voice that a new peer joined, so they can
    // expect an incoming connection from this new socket id
    socket.to(Array.from(voiceParticipants)).emit('voice:peer-joined', { peerId: socket.id });
  });

  // Relay a WebRTC handshake message (offer, answer, or ICE candidate) from
  // one specific peer straight to another specific peer — never broadcast.
  socket.on('voice:signal', ({ to, data }) => {
    io.to(to).emit('voice:signal', { from: socket.id, data });
  });

  // A player turns their mic off manually (not disconnecting entirely)
  socket.on('voice:leave', () => {
    voiceParticipants.delete(socket.id);
    io.emit('voice:peer-left', { peerId: socket.id });
  });

  // ───────────────────────────────────────────
  // CHALLENGE ENGINE EVENTS (Phase 3)
  // ───────────────────────────────────────────
  // Received only from api-server's internal connection — rebroadcast to everyone else
  socket.on('internal:challenge-created', (challengeSummary) => {
    io.emit('challenge:created', challengeSummary);
  });

  // A player opens the Coding Lab live challenge screen — join its Socket.IO room
  socket.on('challenge:join-room', async ({ challengeId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('challenge:error', { message: 'invalid session' });

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return socket.emit('challenge:error', { message: 'challenge not found' });

    socket.join(`challenge:${challengeId}`);

    // Also join a room keyed to this user's id (not just this socket / this
    // challenge). This lets us push a stats update straight to them later
    // even if they've already navigated away from the challenge screen by
    // the time it finishes, or have multiple tabs open.
    socket.join(`user:${userId}`);
    socket.data.userId = userId;

    socket.emit('challenge:room-state', {
      status: challenge.status,
      name: challenge.name,
      questionCount: challenge.questionCount,
      participants: challenge.participants.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.score
      }))
    });

    // If this challenge is already live, immediately re-send the CURRENT question
    // to whoever just joined/reconnected, instead of leaving them waiting for the next one
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

  // The creator clicks "Start" — manual start, per your choice
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

    // Build the in-memory live state for this challenge
    const participantState = {};
    challenge.participants.forEach((p) => {
      participantState[p.userId] = { displayName: p.displayName, score: 0, answeredThisQuestion: false, answers: [] };
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

  // A participant submits their answer to the current question
  socket.on('challenge:answer', async ({ challengeId, questionIndex, selectedIndex, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('challenge:error', { message: 'invalid session' });

    const state = activeChallenges[challengeId];
    if (!state) return socket.emit('challenge:error', { message: 'this challenge is not active' });

    const participant = state.participants[userId];
    if (!participant) return socket.emit('challenge:error', { message: 'you are not part of this challenge' });

    // Ignore late answers for a question that has already moved on
    if (questionIndex !== state.currentQuestionIndex) return;
    // Ignore a second answer from the same person on the same question
    if (participant.answeredThisQuestion) return;

    const correctIndex = state.questions[questionIndex].correctIndex;
    const isCorrect = selectedIndex === correctIndex;

    if (isCorrect) participant.score += 10;
    participant.answeredThisQuestion = true;
    participant.answers.push({ questionIndex, selectedIndex, isCorrect, answeredAt: new Date() });

    // If everyone in the room has now answered, skip the rest of the timer and move on immediately
    const allAnswered = Object.values(state.participants).every((p) => p.answeredThisQuestion);
    if (allAnswered) {
      clearTimeout(state.timer);
      revealAndAdvance(challengeId);
    }
  });

  socket.on('disconnect', () => {
    console.log('player left:', socket.id);
    delete players[socket.id];
    io.emit('player-left', socket.id);

    // Clean up voice chat state too, so others don't keep trying to reach a dead peer
    if (voiceParticipants.has(socket.id)) {
      voiceParticipants.delete(socket.id);
      io.emit('voice:peer-left', { peerId: socket.id });
    }
  });
});

// This loop is the heart of the whole movement system.
// Every 100ms, it moves every player based on their current input,
// then broadcasts the new positions to everyone connected.
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

  if (somethingMoved) {
    io.emit('world-update', Object.values(players));
  }
}, 100);

// ───────────────────────────────────────────
// CHALLENGE ENGINE HELPER FUNCTIONS (Phase 3)
// ───────────────────────────────────────────

function startNextQuestion(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;

  if (state.currentQuestionIndex >= state.questions.length) {
    return finishChallenge(challengeId);
  }

  // Reset "answered" flags for the new question
  Object.values(state.participants).forEach((p) => { p.answeredThisQuestion = false; });

  const q = state.questions[state.currentQuestionIndex];

  io.to(`challenge:${challengeId}`).emit('challenge:question', {
    questionIndex: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
    questionText: q.questionText,
    options: q.options,
    durationSec: state.durationSec
  });

  state.timer = setTimeout(() => {
    revealAndAdvance(challengeId);
  }, state.durationSec * 1000);
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

  // Small pause so players can see the reveal before the next question appears
  setTimeout(() => startNextQuestion(challengeId), 3000);
}

async function finishChallenge(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;

  const finalLeaderboard = Object.entries(state.participants)
    .map(([userId, p]) => ({ userId, displayName: p.displayName, score: p.score }))
    .sort((a, b) => b.score - a.score);

  const topScore = finalLeaderboard.length > 0 ? finalLeaderboard[0].score : 0;

  // Persist final scores + answers back to the Challenge doc — this is the
  // only DB write against the Challenge collection for the whole live game.
  const challenge = await Challenge.findById(challengeId);
  if (challenge) {
    challenge.status = 'COMPLETED';
    challenge.completedAt = new Date();
    challenge.participants.forEach((p) => {
      const result = state.participants[p.userId];
      if (result) {
        p.score = result.score;
        p.answers = result.answers;
      }
    });
    await challenge.save();
  }

  // ── Correct-answers tally + profile update, per participant ──
  // Ties for the top score all count as "winner" — simpler and fairer
  // than picking one arbitrary winner on a tie.
  const statsResults = [];

  for (const [userId, participantState] of Object.entries(state.participants)) {
    const isWinner = participantState.score === topScore && topScore > 0;
    const correctAnswers = participantState.answers.filter((a) => a.isCorrect).length;

    try {
      const user = await User.findById(userId);
      if (!user) continue; // shouldn't happen, but don't crash the whole finish flow over it

      user.profile.totalCorrectAnswers += correctAnswers;
      if (isWinner) user.profile.challengesWon += 1;
      await user.save();

      const result = {
        userId,
        correctAnswers,
        totalQuestions: state.questions.length,
        totalCorrectAnswers: user.profile.totalCorrectAnswers,
        isWinner
      };
      statsResults.push(result);

      // Push the update straight to this user, on whatever screen they're
      // currently on — not just the challenge room.
      io.to(`user:${userId}`).emit('profile:stats-updated', result);
    } catch (err) {
      console.error('failed to update stats for user', userId, err.message);
    }
  }

  // Leaderboard broadcast to the challenge room, now including each
  // person's correct-answer count for this challenge.
  const leaderboardWithStats = finalLeaderboard.map((entry) => ({
    ...entry,
    ...(statsResults.find((r) => r.userId === entry.userId) || {})
  }));

  io.to(`challenge:${challengeId}`).emit('challenge:completed', { leaderboard: leaderboardWithStats });

  delete activeChallenges[challengeId];
}

const REALTIME_PORT = 4001;
httpServer.listen(REALTIME_PORT, () => console.log(`realtime-server running on port ${REALTIME_PORT}`));