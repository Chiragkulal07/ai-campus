import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import MatchResults from './MatchResults';
import './battlefield.css';
import ArenaFighter from './ArenaFighter';
import { formatDuration, initialOf, readJson } from './utils';
import { IconAlert, IconArrowLeft, IconClock, IconCrown, IconTarget, IconUsers } from './icons';
import { API_URL, SOCKET_URL } from './config';

const FIRE_RATE_MS = 220; // ~4.5 shots per second while held down

// Must mirror the server's constants exactly, or prediction will drift
const BATTLE_MOVE_SPEED = 5;
const PLAYER_RADIUS = 16;
const TICK_INTERVAL_MS = 100;

// Tuning for smoothing/reconciliation
const INTERP_DELAY_MS = 100;   // render remote players slightly in the past for smoothness
const SNAP_THRESHOLD = 40;     // if predicted vs server position differs more than this, snap
const LERP_FACTOR = 0.25;      // otherwise, correct gradually by this fraction per update
const PING_INTERVAL_MS = 3000;

function Battlefield({ token, gameId, onExit }) {
  const socketRef = useRef(null);
  const arenaRef = useRef(null);
  const arenaViewportRef = useRef(null);
  const fireIntervalRef = useRef(null);
  const aimAngleRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const [myUserId, setMyUserId] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [gameInfo, setGameInfo] = useState(null);

  const [arenaSize, setArenaSize] = useState({ w: 1000, h: 800 });
  const [arenaDisplaySize, setArenaDisplaySize] = useState({ w: 1000, h: 800 });
  const [walls, setWalls] = useState([]);
  const [players, setPlayers] = useState([]);
  const [msRemaining, setMsRemaining] = useState(0);
  // Local deadline for the match clock. The server only sends updates when
  // someone moves, so we count down locally and re-sync on every update.
  const endAtRef = useRef(null);
  const [aimAngle, setAimAngle] = useState(0);
  const [cursorPercent, setCursorPercent] = useState({ x: 50, y: 50 });
  const [tracers, setTracers] = useState([]);
  const [killFeed, setKillFeed] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [lockedPlayerId, setLockedPlayerId] = useState(null);

  const heldKeys = useRef({ up: false, down: false, left: false, right: false });

  // ── Latency-hiding state ──
  // metaRef: non-positional data per player (hp, kills, displayName) — source of truth
  // predictedPosRef: our own position, moved locally every tick, reconciled against server
  // remoteSnapshotsRef: last couple of server-reported positions per OTHER player, for interpolation
  const metaRef = useRef({});
  const predictedPosRef = useRef(null);
  const remoteSnapshotsRef = useRef({});
  const wallsRef = useRef([]);
  const arenaSizeRef = useRef({ w: 1000, h: 800 });
  const animFrameRef = useRef(null);
  const motionRef = useRef({}); // per-player { x, y, movedAt, facing } for walk/facing visuals
  const predictionIntervalRef = useRef(null);
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    const viewport = arenaViewportRef.current;
    if (!viewport) return undefined;

    const resizeArena = () => {
      const { width, height } = viewport.getBoundingClientRect();
      const scale = Math.min(1, width / arenaSize.w, height / arenaSize.h);
      const nextSize = {
        w: Math.floor(arenaSize.w * scale),
        h: Math.floor(arenaSize.h * scale),
      };

      setArenaDisplaySize((current) => (
        current.w === nextSize.w && current.h === nextSize.h ? current : nextSize
      ));
    };

    const observer = new ResizeObserver(resizeArena);
    observer.observe(viewport);
    resizeArena();
    return () => observer.disconnect();
  }, [arenaSize]);

  useEffect(() => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setMyUserId(payload.userId);
    } catch {
      setErrorMsg('Your session is invalid. Please sign in again.');
    }
  }, [token]);

  useEffect(() => {
    fetch(`${API_URL}/games/${gameId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || 'Could not load this match.');
        return data;
      })
      .then((data) => {
        if (data.status === 'COMPLETED') {
          setErrorMsg('This match has already ended.');
          return;
        }
        setGameInfo(data);
        setPhase(data.status === 'IN_PROGRESS' ? 'in_progress' : 'waiting');
      })
      .catch((err) => {
        const msg = err.message === 'Failed to fetch' ? 'Unable to reach the server.' : err.message;
        setErrorMsg(msg.charAt(0).toUpperCase() + msg.slice(1));
      });
  }, [gameId, token]);

  // Same collision rule as the server's isPositionBlocked — must stay in sync
  function isPositionBlockedClient(x, y) {
    for (const wall of wallsRef.current) {
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

  function seedPlayerState(serverPlayers) {
    const meta = {};
    const snapshots = {};
    const now = Date.now();

    serverPlayers.forEach((p) => {
      meta[p.userId] = { userId: p.userId, displayName: p.displayName, hp: p.hp, kills: p.kills };
      if (p.userId === myUserId) {
        predictedPosRef.current = { x: p.x, y: p.y };
      } else {
        snapshots[p.userId] = [{ t: now, x: p.x, y: p.y }];
      }
    });

    metaRef.current = meta;
    remoteSnapshotsRef.current = snapshots;
  }

  function pushRemoteSnapshot(userId, x, y) {
    const buf = remoteSnapshotsRef.current[userId] || [];
    buf.push({ t: Date.now(), x, y });
    if (buf.length > 3) buf.shift();
    remoteSnapshotsRef.current[userId] = buf;
  }

  function getInterpolatedPosition(userId, fallbackX, fallbackY) {
    const buf = remoteSnapshotsRef.current[userId];
    if (!buf || buf.length === 0) return { x: fallbackX, y: fallbackY };
    if (buf.length === 1) return { x: buf[0].x, y: buf[0].y };

    const renderTime = Date.now() - INTERP_DELAY_MS;
    const latest = buf[buf.length - 1];
    const earliest = buf[0];

    if (renderTime >= latest.t) return { x: latest.x, y: latest.y };
    if (renderTime <= earliest.t) return { x: earliest.x, y: earliest.y };

    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i];
      const b = buf[i + 1];
      if (renderTime >= a.t && renderTime <= b.t) {
        const span = b.t - a.t;
        const frac = span === 0 ? 0 : (renderTime - a.t) / span;
        return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
      }
    }
    return { x: latest.x, y: latest.y };
  }

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('game:watch-lobby', { gameId });
      if (phase === 'in_progress') {
        socket.emit('battle:join-room', { gameId, token });
      }
    });

    socket.on('game:started', () => {
      setPhase('in_progress');
      socket.emit('battle:join-room', { gameId, token });
    });

    socket.on('battle:room-state', (state) => {
      setWalls(state.walls);
      wallsRef.current = state.walls;
      setArenaSize({ w: state.arenaWidth, h: state.arenaHeight });
      arenaSizeRef.current = { w: state.arenaWidth, h: state.arenaHeight };
      endAtRef.current = Date.now() + state.msRemaining;
      setMsRemaining(state.msRemaining);
      seedPlayerState(state.players);
      setPlayers(state.players); // initial paint before the render loop takes over
    });

    socket.on('battle:update', (data) => {
      endAtRef.current = Date.now() + data.msRemaining;
      setMsRemaining(data.msRemaining);

      data.players.forEach((p) => {
        metaRef.current[p.userId] = {
          userId: p.userId, displayName: p.displayName, hp: p.hp, kills: p.kills
        };

        if (p.userId === myUserId) {
          // Reconcile our predicted position against the server's authoritative one
          if (!predictedPosRef.current) {
            predictedPosRef.current = { x: p.x, y: p.y };
            return;
          }
          const dx = p.x - predictedPosRef.current.x;
          const dy = p.y - predictedPosRef.current.y;
          const dist = Math.hypot(dx, dy);

          if (dist > SNAP_THRESHOLD) {
            predictedPosRef.current = { x: p.x, y: p.y };
          } else if (dist > 0.5) {
            predictedPosRef.current = {
              x: predictedPosRef.current.x + dx * LERP_FACTOR,
              y: predictedPosRef.current.y + dy * LERP_FACTOR
            };
          }
        } else {
          pushRemoteSnapshot(p.userId, p.x, p.y);
        }
      });
    });

    socket.on('battle:shot-fired', (data) => {
      if (data.shooterId === myUserId) return;

      const shooterMeta = metaRef.current[data.shooterId];
      const shooterPos = data.shooterId === myUserId
        ? predictedPosRef.current
        : getInterpolatedPosition(data.shooterId, null, null);

      if (shooterMeta && shooterPos && shooterPos.x != null && data.hitPoint) {
        const tracerId = `${data.shooterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setTracers((prev) => [...prev, { id: tracerId, x1: shooterPos.x, y1: shooterPos.y, x2: data.hitPoint.x, y2: data.hitPoint.y }]);
        setTimeout(() => setTracers((prev) => prev.filter((t) => t.id !== tracerId)), 120);
      }
    });

    socket.on('battle:hit', (data) => {
      const m = metaRef.current[data.targetId];
      if (m) m.hp = data.newHp;
    });

    socket.on('battle:kill', (data) => {
      const feedId = `${data.victimId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setKillFeed((prev) => [...prev, {
        id: feedId,
        text: `${data.killerName} eliminated ${data.victimName}`,
        killer: data.killerName,
        victim: data.victimName,
        killerId: data.killerId,
        victimId: data.victimId,
      }].slice(-5));
      setTimeout(() => setKillFeed((prev) => prev.filter((k) => k.id !== feedId)), 4000);

      const m = metaRef.current[data.victimId];
      if (m) m.hp = 0;
    });

    socket.on('battle:respawn', (data) => {
      const m = metaRef.current[data.userId];
      if (m) m.hp = 100;

      if (data.userId === myUserId) {
        predictedPosRef.current = { x: data.x, y: data.y };
      } else {
        // hard reset the interpolation buffer so we don't tween across the whole arena
        remoteSnapshotsRef.current[data.userId] = [{ t: Date.now(), x: data.x, y: data.y }];
      }
    });

    socket.on('battle:match-ended', (data) => {
      setFinalLeaderboard(data.leaderboard);
      setPhase('ended');
    });

    socket.on('battle:pong', (data) => {
      const rtt = Date.now() - data.clientTime;
      socket.emit('battle:latency-report', { token, rtt });
    });

    socket.on('game:error', (err) => {
      setErrorMsg(err.message);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, token, phase === 'in_progress', myUserId]);

  // ── Local prediction loop: move our own player immediately, don't wait for the server ──
  useEffect(() => {
    if (phase !== 'in_progress') return;

    predictionIntervalRef.current = setInterval(() => {
      if (!predictedPosRef.current) return;
      const dx = (heldKeys.current.right ? 1 : 0) - (heldKeys.current.left ? 1 : 0);
      const dy = (heldKeys.current.down ? 1 : 0) - (heldKeys.current.up ? 1 : 0);
      if (dx === 0 && dy === 0) return;

      const { w, h } = arenaSizeRef.current;
      let nextX = predictedPosRef.current.x;
      let nextY = predictedPosRef.current.y;

      if (dx !== 0) {
        const testX = clamp(nextX + dx * BATTLE_MOVE_SPEED, PLAYER_RADIUS, w - PLAYER_RADIUS);
        if (!isPositionBlockedClient(testX, nextY)) nextX = testX;
      }
      if (dy !== 0) {
        const testY = clamp(nextY + dy * BATTLE_MOVE_SPEED, PLAYER_RADIUS, h - PLAYER_RADIUS);
        if (!isPositionBlockedClient(nextX, testY)) nextY = testY;
      }

      predictedPosRef.current = { x: nextX, y: nextY };
    }, TICK_INTERVAL_MS);

    return () => clearInterval(predictionIntervalRef.current);
  }, [phase]);

  // ── Render loop: builds the `players` array from predicted + interpolated positions ──
  useEffect(() => {
    if (phase !== 'in_progress') return;

    function frame() {
      const now = performance.now();
      const motion = motionRef.current;
      const withMotion = (m, pos) => {
        const prev = motion[m.userId];
        let movedAt = prev ? prev.movedAt : 0;
        let facing = prev ? prev.facing : 1;
        if (prev) {
          const dx = pos.x - prev.x;
          const dy = pos.y - prev.y;
          if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) movedAt = now;
          if (Math.abs(dx) > 0.2) facing = dx < 0 ? -1 : 1;
        }
        motion[m.userId] = { x: pos.x, y: pos.y, movedAt, facing };
        // own position updates every server tick (100ms), so allow a small grace window
        return { ...m, x: pos.x, y: pos.y, moving: now - movedAt < 180, facing };
      };
      const merged = Object.values(metaRef.current).map((m) => {
        if (m.userId === myUserId) {
          return withMotion(m, predictedPosRef.current || { x: 0, y: 0 });
        }
        return withMotion(m, getInterpolatedPosition(m.userId, 0, 0));
      });
      setPlayers(merged);
      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [phase, myUserId]);

  // ── Match clock: tick locally so the timer runs even when nobody moves ──
  useEffect(() => {
    if (phase !== 'in_progress') return undefined;
    const id = setInterval(() => {
      if (endAtRef.current == null) return;
      setMsRemaining(Math.max(0, endAtRef.current - Date.now()));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // ── Ping loop: measure RTT periodically so the server can lag-compensate our shots ──
  useEffect(() => {
    if (phase !== 'in_progress') return;

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current) {
        socketRef.current.emit('battle:ping', { clientTime: Date.now() });
      }
    }, PING_INTERVAL_MS);

    return () => clearInterval(pingIntervalRef.current);
  }, [phase]);

  // ── Aim Assist Target Snapping & Locking Logic ──
  useEffect(() => {
    const me = players.find((p) => p.userId === myUserId);
    if (!me) return;

    const mouseArenaX = mousePosRef.current.x;
    const mouseArenaY = mousePosRef.current.y;

    let targetX = mouseArenaX;
    let targetY = mouseArenaY;
    let bestDist = Infinity;
    let foundTargetId = null;

    const ASSIST_RADIUS = 95;

    players.forEach((p) => {
      if (p.userId === myUserId || p.hp <= 0) return;
      const dx = p.x - mouseArenaX;
      const dy = p.y - mouseArenaY;
      const dist = Math.hypot(dx, dy);
      if (dist < ASSIST_RADIUS && dist < bestDist) {
        bestDist = dist;
        targetX = p.x;
        targetY = p.y;
        foundTargetId = p.userId;
      }
    });

    const angle = Math.atan2(targetY - me.y, targetX - me.x);
    aimAngleRef.current = angle;
    setAimAngle(angle);
    setLockedPlayerId(foundTargetId);
  }, [players, cursorPercent, myUserId]);

  const handleStartMatch = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('game:start', { gameId, token });
  };

  const handleMouseMove = (e) => {
    if (!arenaRef.current) return;

    const rect = arenaRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPercent({ x: xPct, y: yPct });

    const scaleX = arenaSize.w / rect.width;
    const scaleY = arenaSize.h / rect.height;
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const playersRef = useRef([]);
  const lockedPlayerIdRef = useRef(null);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    lockedPlayerIdRef.current = lockedPlayerId;
  }, [lockedPlayerId]);

  const createLocalTracer = () => {
    const currentPlayers = playersRef.current;
    const me = currentPlayers.find((p) => p.userId === myUserId);
    if (!me) return;

    const angle = aimAngleRef.current;
    let targetX = me.x + Math.cos(angle) * 1200;
    let targetY = me.y + Math.sin(angle) * 1200;

    const currentLockedId = lockedPlayerIdRef.current;
    if (currentLockedId) {
      const lockedEnemy = currentPlayers.find((p) => p.userId === currentLockedId);
      if (lockedEnemy) {
        targetX = lockedEnemy.x;
        targetY = lockedEnemy.y;
      }
    }

    const tracerId = `local-${myUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setTracers((prev) => [...prev, { id: tracerId, x1: me.x, y1: me.y, x2: targetX, y2: targetY }]);
    setTimeout(() => setTracers((prev) => prev.filter((t) => t.id !== tracerId)), 120);
  };

  const fireOnce = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('battle:fire', { gameId, token, angle: aimAngleRef.current });
    createLocalTracer();
  };

  const startFiring = () => {
    if (fireIntervalRef.current) return;
    fireOnce();
    fireIntervalRef.current = setInterval(fireOnce, FIRE_RATE_MS);
  };

  const stopFiring = () => {
    if (fireIntervalRef.current) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
  };

  const sendMoveInput = () => {
    if (!socketRef.current) return;
    const dx = (heldKeys.current.right ? 1 : 0) - (heldKeys.current.left ? 1 : 0);
    const dy = (heldKeys.current.down ? 1 : 0) - (heldKeys.current.up ? 1 : 0);
    socketRef.current.emit('battle:move-input', { gameId, token, dx, dy });
  };

  useEffect(() => {
    if (phase !== 'in_progress') return;

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') heldKeys.current.up = true;
      if (key === 'arrowdown' || key === 's') heldKeys.current.down = true;
      if (key === 'arrowleft' || key === 'a') heldKeys.current.left = true;
      if (key === 'arrowright' || key === 'd') heldKeys.current.right = true;
      if (key === ' ') { e.preventDefault(); startFiring(); }
      sendMoveInput();
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') heldKeys.current.up = false;
      if (key === 'arrowdown' || key === 's') heldKeys.current.down = false;
      if (key === 'arrowleft' || key === 'a') heldKeys.current.left = false;
      if (key === 'arrowright' || key === 'd') heldKeys.current.right = false;
      if (key === ' ') stopFiring();
      sendMoveInput();
    };
    // Release all inputs when the window loses focus (e.g. alt-tab),
    // otherwise the player keeps moving/firing with no key held.
    const handleBlur = () => {
      heldKeys.current = { up: false, down: false, left: false, right: false };
      stopFiring();
      sendMoveInput();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      stopFiring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameId, token]);

  if (phase === 'loading') {
    return (
      <div className="splash">
        {errorMsg ? (
          <>
            <div className="alert" style={{ maxWidth: 360 }}><IconAlert size={15} /><span>{errorMsg}</span></div>
            <button type="button" className="btn btn-secondary" onClick={onExit}>
              <IconArrowLeft size={15} /> Back to Gaming Lab
            </button>
          </>
        ) : (
          <>
            <div className="row"><span className="spinner" /> Connecting to match…</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
              <IconArrowLeft size={14} /> Back to Gaming Lab
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'waiting') {
    const isCreator = gameInfo && myUserId === gameInfo.creatorId;
    const participants = gameInfo?.participants || [];

    return (
      <div className="app-scroll">
        <div className="page page-narrow" style={{ maxWidth: 560, paddingTop: 40 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExit} style={{ marginBottom: 16, marginLeft: -10 }}>
            <IconArrowLeft size={14} /> Leave lobby
          </button>

          <div className="card lobby-card" style={{ padding: 24 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h1 className="page-title truncate">{gameInfo ? gameInfo.name : 'Match lobby'}</h1>
                <p className="page-subtitle">
                  {isCreator ? 'You are the host. Start the match when everyone is ready.' : 'Waiting for the host to start the match.'}
                </p>
              </div>
              <span className="badge badge-green"><span className="dot dot-live" /> Lobby</span>
            </div>

            {gameInfo && (
              <div className="list-row-meta" style={{ marginTop: 12 }}>
                <span><IconUsers size={13} /> {participants.length}/{gameInfo.maxPlayers} players</span>
                {gameInfo.durationSec ? <span><IconClock size={13} /> {formatDuration(gameInfo.durationSec)}</span> : null}
              </div>
            )}

            {errorMsg && (
              <div className="alert" style={{ marginTop: 16 }}><IconAlert size={15} /><span>{errorMsg}</span></div>
            )}

            <div className="section-title" style={{ marginTop: 24, marginBottom: 8 }}>Players</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {participants.length === 0 && (
                <div className="muted" style={{ padding: '12px 14px', fontSize: 13 }}>No players yet.</div>
              )}
              {participants.map((p, i) => {
                const isYou = p.userId === myUserId;
                const isHost = p.userId === gameInfo.creatorId;
                return (
                  <div
                    key={p.userId}
                    className="row lobby-row"
                    style={{
                      '--i': i,
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderTop: i ? '1px solid var(--border)' : 'none',
                      background: isYou ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <span className="avatar" style={{ width: 26, height: 26, fontSize: 11, background: 'var(--surface-3)' }}>
                        {initialOf(p.displayName)}
                      </span>
                      <span className="truncate" style={{ fontWeight: isYou ? 600 : 500 }}>{p.displayName}</span>
                      {isYou && <span className="badge badge-accent">You</span>}
                    </div>
                    {isHost && <span className="badge badge-yellow"><IconCrown size={11} /> Host</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24 }}>
              {isCreator ? (
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleStartMatch}>
                  Start match
                </button>
              ) : (
                <div className="row muted" style={{ justifyContent: 'center', padding: 12, fontSize: 13.5 }}>
                  <span className="radar"><span /></span> Waiting for host…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'ended') {
    return <MatchResults leaderboard={finalLeaderboard} myUserId={myUserId} onExit={onExit} />;
  }

  const secondsLeft = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const me = players.find((p) => p.userId === myUserId);
  const myHp = me ? Math.max(0, me.hp) : 0;
  const totalMs = (gameInfo?.durationSec || 0) * 1000;
  const timePct = totalMs > 0 ? Math.max(0, Math.min(100, (msRemaining / totalMs) * 100)) : 100;
  const isFinalSeconds = secondsLeft <= 10;
  const isCritical = !!me && me.hp > 0 && me.hp <= 40;
  const isDown = !!me && me.hp <= 0;
  const hpSegments = Math.ceil(myHp / 20); // 5 segments: one hit = 20 HP
  const standings = [...players].sort((a, b) => (b.kills || 0) - (a.kills || 0));

  return (
    <div className="bf">
      <style>{`
        @keyframes bullet-fly {
          0% { transform: translate(0px, 0px); }
          100% { transform: translate(var(--dx), var(--dy)); }
        }
      `}</style>

      {/* ── HUD ─────────────────────────────────────────── */}
      <header className="bf-hud">
        <div className="bf-hud-left">
          <button type="button" className="bf-leave" onClick={onExit}>
            <IconArrowLeft size={14} /> Leave
          </button>
          <div className="bf-match">
            <span className="bf-live"><i /> Live</span>
            <span className="bf-match-name">{gameInfo?.name || 'Arena match'}</span>
          </div>
        </div>

        <div className={`bf-timer ${isFinalSeconds ? 'is-final' : ''}`}>
          <div className="bf-timer-digits">
            <span>{minutes}</span><b>:</b><span>{seconds}</span>
          </div>
          <div className="bf-timer-bar"><div style={{ width: `${timePct}%` }} /></div>
        </div>

        <div className="bf-hud-right">
          <div className="bf-stat">
            <span className="bf-stat-label">Kills</span>
            <span className="bf-stat-value" key={me ? me.kills : 0}>{me ? me.kills : 0}</span>
          </div>
          <div className={`bf-hp ${isCritical ? 'is-critical' : ''}`} aria-label={`Health ${myHp}`}>
            <span className="bf-stat-label">HP</span>
            <div className="bf-hp-cells">
              {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < hpSegments ? 'is-on' : ''} />)}
            </div>
            <span className="bf-hp-num">{myHp}</span>
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="alert" style={{ margin: '0 0 10px' }}><IconAlert size={15} /><span>{errorMsg}</span></div>
      )}

      <div className="bf-body">
        {/* ── Arena ─────────────────────────────────────── */}
        <div ref={arenaViewportRef} className="bf-viewport">
          <div
            ref={arenaRef}
            className={`bf-arena ${isCritical ? 'is-critical' : ''} ${isDown ? 'is-down' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseDown={(e) => { e.preventDefault(); startFiring(); }}
            onMouseUp={stopFiring}
            onMouseLeave={stopFiring}
            onDoubleClick={(e) => { e.preventDefault(); fireOnce(); }}
            style={{ width: `${arenaDisplaySize.w}px`, height: `${arenaDisplaySize.h}px` }}
          >
            <span className="bf-corner bf-c-tl" />
            <span className="bf-corner bf-c-tr" />
            <span className="bf-corner bf-c-bl" />
            <span className="bf-corner bf-c-br" />

            {walls.map((wall, i) => (
              <div
                key={i}
                className="bf-wall"
                style={{
                  left: `${(wall.x / arenaSize.w) * 100}%`,
                  top: `${(wall.y / arenaSize.h) * 100}%`,
                  width: `${(wall.width / arenaSize.w) * 100}%`,
                  height: `${(wall.height / arenaSize.h) * 100}%`,
                  '--i': i,
                }}
              />
            ))}

            <svg className="bf-fx" viewBox={`0 0 ${arenaSize.w} ${arenaSize.h}`}>
              <defs>
                <filter id="bf-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                {me && (
                  <linearGradient
                    id="bf-aim-grad"
                    gradientUnits="userSpaceOnUse"
                    x1={me.x}
                    y1={me.y}
                    x2={me.x + Math.cos(aimAngle) * 700}
                    y2={me.y + Math.sin(aimAngle) * 700}
                  >
                    <stop offset="0%" stopColor={lockedPlayerId ? '#f87171' : '#fbbf24'} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={lockedPlayerId ? '#f87171' : '#fbbf24'} stopOpacity="0" />
                  </linearGradient>
                )}
              </defs>

              {me && me.hp > 0 && (
                <g className="bf-aim">
                  <line
                    x1={me.x}
                    y1={me.y}
                    x2={me.x + Math.cos(aimAngle) * 700}
                    y2={me.y + Math.sin(aimAngle) * 700}
                    stroke="url(#bf-aim-grad)"
                    strokeWidth="6"
                    opacity="0.25"
                    filter="url(#bf-glow)"
                  />
                  <line
                    className="bf-aim-dots"
                    x1={me.x}
                    y1={me.y}
                    x2={me.x + Math.cos(aimAngle) * 700}
                    y2={me.y + Math.sin(aimAngle) * 700}
                    stroke="url(#bf-aim-grad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {tracers.map((t) => {
                const dx = t.x2 - t.x1;
                const dy = t.y2 - t.y1;
                const angle = Math.atan2(dy, dx);
                const bulletLength = 42;
                return (
                  <g key={t.id}>
                    <circle className="bf-muzzle" cx={t.x1} cy={t.y1} r="9" />
                    <g style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animation: 'bullet-fly 0.12s linear forwards' }}>
                      <line
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x1 + Math.cos(angle) * bulletLength}
                        y2={t.y1 + Math.sin(angle) * bulletLength}
                        stroke="#fb923c"
                        strokeWidth="6"
                        strokeLinecap="round"
                        opacity="0.75"
                        filter="url(#bf-glow)"
                      />
                      <line
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x1 + Math.cos(angle) * bulletLength}
                        y2={t.y1 + Math.sin(angle) * bulletLength}
                        stroke="#fff7ed"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                    <circle className="bf-impact" cx={t.x2} cy={t.y2} r="10" />
                  </g>
                );
              })}
            </svg>

            {players.map((p) => {
              const isMe = p.userId === myUserId;
              const isTargeted = p.userId === lockedPlayerId;
              const hp = Math.max(0, Math.min(100, p.hp));
              return (
                <div
                  key={p.userId}
                  className={`bf-player ${isMe ? 'is-me' : 'is-enemy'} ${isTargeted ? 'is-targeted' : ''} ${hp <= 40 ? 'is-low' : ''}`}
                  style={{
                    left: `${(p.x / arenaSize.w) * 100}%`,
                    top: `${(p.y / arenaSize.h) * 100}%`,
                    display: p.hp > 0 ? 'block' : 'none',
                    zIndex: isMe ? 10 : 5,
                  }}
                >
                  <div className="bf-label">
                    <div className="bf-tag">{isMe ? 'You' : p.displayName}</div>
                    <div className="bf-hpbar"><i style={{ width: `${hp}%` }} /></div>
                  </div>
                  <div className="bf-fighter">
                    <ArenaFighter
                      color={isMe ? '#fbbf24' : '#fb7185'}
                      shade={isMe ? '#b45309' : '#be123c'}
                      facingLeft={isMe ? Math.cos(aimAngle) < 0 : p.facing < 0}
                      aimAngle={isMe ? aimAngle : null}
                      moving={!!p.moving}
                    />
                    {isTargeted && <div className="bf-lock"><i /><i /><i /><i /></div>}
                  </div>
                </div>
              );
            })}

            {/* Kill feed overlay */}
            <div className="bf-feed" aria-live="polite">
              {killFeed.map((k) => {
                const mine = k.killerId === myUserId;
                const died = k.victimId === myUserId;
                return (
                  <div key={k.id} className={`bf-feed-item ${mine ? 'is-mine' : ''} ${died ? 'is-death' : ''}`}>
                    <span className="bf-feed-killer">{mine ? 'You' : k.killer}</span>
                    <IconTarget size={12} />
                    <span className="bf-feed-victim">{died ? 'You' : k.victim}</span>
                  </div>
                );
              })}
            </div>

            {/* Crosshair */}
            <div
              className={`bf-crosshair ${lockedPlayerId ? 'is-locked' : ''}`}
              style={{ left: `${cursorPercent.x}%`, top: `${cursorPercent.y}%` }}
            >
              <span className="bf-ch-ring" />
              <span className="bf-ch-tick t" />
              <span className="bf-ch-tick b" />
              <span className="bf-ch-tick l" />
              <span className="bf-ch-tick r" />
              <span className="bf-ch-dot" />
            </div>

            {/* Eliminated overlay with a 3 s respawn ring (matches the server's respawn delay) */}
            {isDown && (
              <div className="bf-down">
                <div className="bf-down-ring">
                  <svg viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="28" className="bf-down-track" />
                    <circle cx="32" cy="32" r="28" className="bf-down-arc" />
                  </svg>
                  <IconTarget size={20} />
                </div>
                <div className="bf-down-title">Eliminated</div>
                <div className="bf-down-sub">Respawning…</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live standings ────────────────────────────── */}
        <aside className="bf-side">
          <div className="bf-side-title">Standings</div>
          <div className="bf-standings">
            {standings.map((p, i) => {
              const isMe = p.userId === myUserId;
              return (
                <div key={p.userId} className={`bf-standing ${isMe ? 'is-me' : ''} ${p.hp <= 0 ? 'is-down' : ''}`}>
                  <span className="bf-rank">{i + 1}</span>
                  <span className="bf-standing-name">{isMe ? 'You' : p.displayName}</span>
                  <span className="bf-standing-kills">{p.kills || 0}</span>
                  <span className="bf-standing-hp"><i style={{ width: `${Math.max(0, Math.min(100, p.hp))}%` }} /></span>
                </div>
              );
            })}
          </div>

          <div className="bf-side-title" style={{ marginTop: 18 }}>Controls</div>
          <div className="bf-keys">
            <div><span className="bf-kbd-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>Move</div>
            <div><span className="bf-kbd-row"><kbd>Mouse</kbd></span>Aim</div>
            <div><span className="bf-kbd-row"><kbd>Click</kbd><kbd>Space</kbd></span>Fire</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Battlefield;