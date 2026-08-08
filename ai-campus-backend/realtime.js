require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Challenge = require('./models/Challenge');
const GameMatch = require('./models/GameMatch');
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
const players = {};

// Live state for challenges currently in progress, keyed by challengeId.
const activeChallenges = {};

// Who currently has their mic "on" and is part of the global voice mesh.
const voiceParticipants = new Set();

// ───────────────────────────────────────────
// GAMING LAB — BATTLEFIELD STATE
// ───────────────────────────────────────────

const ARENA_WIDTH = 1000;
const ARENA_HEIGHT = 800;
const PLAYER_RADIUS = 16;
const BATTLE_MOVE_SPEED = 5;

const WALLS = [
  { x: 400, y: 150, width: 200, height: 40 },   // top-mid wall
  { x: 150, y: 350, width: 40, height: 200 },   // left wall
  { x: 810, y: 350, width: 40, height: 200 },   // right wall
  { x: 400, y: 610, width: 200, height: 40 },   // bottom-mid wall
  { x: 480, y: 380, width: 40, height: 40 }     // small center block
];

const SPAWN_POINTS = [
  { x: 80, y: 80 },
  { x: 920, y: 80 },
  { x: 80, y: 720 },
  { x: 920, y: 720 }
];

// Live state for battles currently in progress, keyed by gameId.
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

// Casts a ray from the shooter's position, at the given angle, and checks
// what it hits first — a wall (blocks the shot entirely) or another player
// (registers a hit). This is the server's own understanding of what happened,
// never trusted from the client.
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

// Ends a battle when the time limit runs out — builds the final kill ranking,
// persists the match as COMPLETED in MongoDB, saves each participant's result
// to their own profile's gameHistory, then broadcasts the results to everyone
// still in the room and tears down the in-memory battle state.
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

      // Save each participant's result into their own profile history
      for (let rankIndex = 0; rankIndex < finalLeaderboard.length; rankIndex++) {
        const entry = finalLeaderboard[rankIndex];
        await User.findByIdAndUpdate(entry.userId, {
          $push: {
            gameHistory: {
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

// Small helper — verifies a token and returns the userId, or null if invalid
function getUserIdFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    return null;
  }
}

const MOVE_SPEED = 4; // campus movement speed, unrelated to battlefield speed

io.on('connection', (socket) => {
  console.log('player joined:', socket.id);

  players[socket.id] = {
    id: socket.id,
    x: 100,
    y: 100,
    dx: 0,
    dy: 0,
    displayName: 'Guest',
    bodyColor: 'dodgerblue'
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

  // ───────────────────────────────────────────
  // VOICE CHAT SIGNALING (global, WebRTC mesh)
  // ───────────────────────────────────────────
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

  // ───────────────────────────────────────────
  // CHALLENGE ENGINE EVENTS
  // ───────────────────────────────────────────
  socket.on('internal:challenge-created', (challengeSummary) => {
    io.emit('challenge:created', challengeSummary);
  });

  socket.on('internal:game-created', (gameSummary) => {
    io.emit('game:created', gameSummary);
  });

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
        userId: p.userId,
        displayName: p.displayName,
        score: p.score
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

  // ───────────────────────────────────────────
  // GAMING LAB — LOBBY-TO-BATTLEFIELD EVENTS
  // ───────────────────────────────────────────

  // The creator manually starts the match — moves it from lobby into a live battle
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
        userId: p.userId,
        displayName: p.displayName,
        x: spawn.x,
        y: spawn.y,
        dx: 0,
        dy: 0,
        hp: 100,
        kills: 0,
        socketId: null
      };
    });

    activeBattles[gameId] = {
      walls: WALLS,
      players: battlePlayers,
      durationSec: match.durationSec,
      endsAt: Date.now() + match.durationSec * 1000,
      endTimer: null
    };

    // Schedule the match to automatically end once the time limit runs out
    activeBattles[gameId].endTimer = setTimeout(() => {
      endBattle(gameId);
    }, match.durationSec * 1000);

    io.to(`game:${gameId}`).emit('game:started', {
      walls: WALLS,
      arenaWidth: ARENA_WIDTH,
      arenaHeight: ARENA_HEIGHT,
      durationSec: match.durationSec
    });
  });

  // Anyone viewing the waiting room joins this room immediately, purely so
  // they're guaranteed to receive the "game:started" broadcast when it fires —
  // this has nothing to do with the battle itself starting yet.
  socket.on('game:watch-lobby', ({ gameId }) => {
    socket.join(`game:${gameId}`);
  });

  // A player's browser opens the battlefield screen — join its Socket.IO room
  socket.on('battle:join-room', async ({ gameId, token }) => {
    const userId = getUserIdFromToken(token);
    if (!userId) return socket.emit('game:error', { message: 'invalid session' });

    socket.join(`game:${gameId}`);

    const battle = activeBattles[gameId];
    if (!battle) {
      return socket.emit('game:error', { message: 'this battle has not started yet' });
    }

    const playerState = battle.players[userId];
    if (!playerState) {
      return socket.emit('game:error', { message: 'you are not part of this game' });
    }

    playerState.socketId = socket.id;

    socket.emit('battle:room-state', {
      walls: battle.walls,
      arenaWidth: ARENA_WIDTH,
      arenaHeight: ARENA_HEIGHT,
      players: Object.values(battle.players).map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        x: p.x,
        y: p.y,
        hp: p.hp,
        kills: p.kills
      })),
      msRemaining: Math.max(0, battle.endsAt - Date.now())
    });
  });

  // Movement inside the battlefield — same "send intent, not position" rule as campus movement
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

  // A player fires a shot — client sends WHERE they clicked (angle), server decides
  // what it actually hits, checking walls and other players' real positions.
  socket.on('battle:fire', ({ gameId, token, angle }) => {
    const shooterId = getUserIdFromToken(token);
    if (!shooterId) return;

    const battle = activeBattles[gameId];
    if (!battle) return;

    const shooter = battle.players[shooterId];
    if (!shooter || shooter.hp <= 0) return;

    const hitResult = raycastForHit(battle, shooter, angle);

    io.to(`game:${gameId}`).emit('battle:shot-fired', {
      shooterId,
      angle,
      hitPoint: hitResult ? hitResult.point : null
    });

    if (hitResult && hitResult.type === 'player') {
      const target = battle.players[hitResult.targetId];
      if (!target || target.hp <= 0) return;

      target.hp = Math.max(0, target.hp - 20);

      if (target.hp === 0) {
        shooter.kills += 1;

        io.to(`game:${gameId}`).emit('battle:kill', {
          killerId: shooterId,
          killerName: shooter.displayName,
          victimId: target.userId,
          victimName: target.displayName,
          killerKills: shooter.kills
        });

        setTimeout(() => {
          const stillActive = activeBattles[gameId];
          if (!stillActive) return; // match may have ended before the respawn timer fired
          const respawning = stillActive.players[target.userId];
          if (!respawning) return;

          const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
          respawning.x = spawn.x;
          respawning.y = spawn.y;
          respawning.hp = 100;

          io.to(`game:${gameId}`).emit('battle:respawn', {
            userId: respawning.userId,
            x: respawning.x,
            y: respawning.y
          });
        }, 3000);
      } else {
        io.to(`game:${gameId}`).emit('battle:hit', {
          targetId: target.userId,
          newHp: target.hp,
          shooterId
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

// Campus movement tick loop — unchanged
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

// Battlefield movement tick loop
setInterval(() => {
  for (const gameId in activeBattles) {
    const battle = activeBattles[gameId];
    let somethingMoved = false;

    for (const userId in battle.players) {
      const p = battle.players[userId];
      if (p.dx === 0 && p.dy === 0) continue;

      let nextX = p.x;
      let nextY = p.y;

      if (p.dx !== 0) {
        const testX = clamp(p.x + p.dx * BATTLE_MOVE_SPEED, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
        if (!isPositionBlocked(testX, p.y)) nextX = testX;
      }
      if (p.dy !== 0) {
        const testY = clamp(p.y + p.dy * BATTLE_MOVE_SPEED, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
        if (!isPositionBlocked(nextX, testY)) nextY = testY;
      }

      p.x = nextX;
      p.y = nextY;
      somethingMoved = true;
    }

    if (somethingMoved) {
      io.to(`game:${gameId}`).emit('battle:update', {
        players: Object.values(battle.players).map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          x: p.x,
          y: p.y,
          hp: p.hp,
          kills: p.kills
        })),
        msRemaining: Math.max(0, battle.endsAt - Date.now())
      });
    }
  }
}, 100);

// ───────────────────────────────────────────
// CHALLENGE ENGINE HELPER FUNCTIONS
// ───────────────────────────────────────────

function startNextQuestion(challengeId) {
  const state = activeChallenges[challengeId];
  if (!state) return;

  if (state.currentQuestionIndex >= state.questions.length) {
    return finishChallenge(challengeId);
  }

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

const REALTIME_PORT = 4001;
httpServer.listen(REALTIME_PORT, () => console.log(`realtime-server running on port ${REALTIME_PORT}`));