const jwt = require('jsonwebtoken');
const GameMatch = require('./models/GameMatch');
const User = require('./models/User');

// In-memory states
const players = {};
const voiceParticipants = new Set();
const activeBattles = {};
const latencyByUserId = {}; // userId -> RTT in ms, updated via ping/pong

// Physics constants
const ARENA_WIDTH = 1000;
const ARENA_HEIGHT = 800;
const PLAYER_RADIUS = 16;
const BATTLE_MOVE_SPEED = 5;
const TICK_INTERVAL_MS = 100; // battle loop tick rate — also the unit for position history
const HISTORY_SIZE = 30;
const MAX_REWIND_MS = 200; // 30 ticks * 100ms = 3s of rewind buffer per player

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

const BULLET_RANGE = 900;
const BULLET_STEP = 8;
const HIT_RADIUS = 18;
const MOVE_SPEED = 4;

// Helper functions
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

// Interpolates a player's rewound position from their tick-indexed history buffer.
// If rewindTick is newer than our latest snapshot, falls back to live position.
// If older than our earliest snapshot, clamps to the earliest known position.
function getRewoundPosition(history, rewindTick, fallbackX, fallbackY) {
  if (!history || history.length === 0) return { x: fallbackX, y: fallbackY };

  const latest = history[history.length - 1];
  const earliest = history[0];

  if (rewindTick >= latest.tick) return { x: fallbackX, y: fallbackY };
  if (rewindTick <= earliest.tick) return { x: earliest.x, y: earliest.y };

  for (let i = 0; i < history.length - 1; i++) {
    const a = history[i];
    const b = history[i + 1];
    if (rewindTick >= a.tick && rewindTick <= b.tick) {
      const span = b.tick - a.tick;
      const frac = span === 0 ? 0 : (rewindTick - a.tick) / span;
      return {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac
      };
    }
  }
  return { x: fallbackX, y: fallbackY };
}

// rewoundPositions: { [userId]: { x, y } } — precomputed lag-compensated target positions.
// Falls back to the target's live position if not present in the map.
function raycastForHit(battle, shooter, angle, rewoundPositions) {
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

      const pos = (rewoundPositions && rewoundPositions[userId]) || target;
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
        return { type: 'player', targetId: userId, point: { x, y } };
      }
    }
  }
  return null;
}

function getUserIdFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    return null;
  }
}

// Socket Initialization
function initSocket(io) {
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
          hp: 100, kills: 0, socketId: null,
          history: [{ tick: 0, x: spawn.x, y: spawn.y }] // rewind buffer, seeded at spawn
        };
      });

      activeBattles[gameId] = {
        walls: WALLS, players: battlePlayers,
        durationSec: match.durationSec,
        endsAt: Date.now() + match.durationSec * 1000,
        endTimer: null,
        tick: 0
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

    // Latency measurement — client pings, we echo back immediately.
    // Client computes RTT itself and reports it via battle:latency-report.
    socket.on('battle:ping', ({ clientTime }) => {
      socket.emit('battle:pong', { clientTime, serverTime: Date.now() });
    });

    socket.on('battle:latency-report', ({ token, rtt }) => {
      const userId = getUserIdFromToken(token);
      if (!userId) return;
      // clamp to something sane in case of a bad reading
      latencyByUserId[userId] = Math.max(0, Math.min(1000, rtt));
    });

    socket.on('battle:fire', ({ gameId, token, angle }) => {
      const shooterId = getUserIdFromToken(token);
      if (!shooterId) return;
      const battle = activeBattles[gameId];
      if (!battle) return;
      const shooter = battle.players[shooterId];
      if (!shooter || shooter.hp <= 0) return;

      // Lag compensation: rewind every other player's position to where they
      // were when the shooter's client actually saw them, based on shooter's
      // known RTT. We rewind by half the RTT (one-way trip to the server).
      const latency = latencyByUserId[shooterId] || 0;
      const compensationMs = Math.min(latency / 2, MAX_REWIND_MS);
      const ticksToRewind = Math.round(compensationMs / TICK_INTERVAL_MS);
      const rewindTick = battle.tick - ticksToRewind;

      const rewoundPositions = {};
      for (const userId in battle.players) {
        if (userId === shooterId) continue;
        const target = battle.players[userId];
        rewoundPositions[userId] = getRewoundPosition(target.history, rewindTick, target.x, target.y);
      }

      const hitResult = raycastForHit(battle, shooter, angle, rewoundPositions);

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
            // Reset history so old pre-death positions can't be rewound into
            respawning.history = [{ tick: stillActive.tick, x: spawn.x, y: spawn.y }];
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
      battle.tick += 1;
      let somethingMoved = false;

      for (const userId in battle.players) {
        const p = battle.players[userId];

        if (p.dx !== 0 || p.dy !== 0) {
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

        // Record this tick's position for every player, every tick — even if
        // stationary — so the rewind lookup always has continuous data.
        if (!p.history) p.history = [];
        p.history.push({ tick: battle.tick, x: p.x, y: p.y });
        if (p.history.length > HISTORY_SIZE) p.history.shift();
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
  }, TICK_INTERVAL_MS);
}

module.exports = {
  initSocket
};