import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import MatchResults from './MatchResults';
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
  const fireIntervalRef = useRef(null);
  const aimAngleRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const [myUserId, setMyUserId] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [gameInfo, setGameInfo] = useState(null);

  const [arenaSize, setArenaSize] = useState({ w: 1000, h: 800 });
  const [walls, setWalls] = useState([]);
  const [players, setPlayers] = useState([]);
  const [msRemaining, setMsRemaining] = useState(0);
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
  const predictionIntervalRef = useRef(null);
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setMyUserId(payload.userId);
    } catch (err) {
      setErrorMsg('could not read session');
    }
  }, [token]);

  useEffect(() => {
    fetch(`${API_URL}/games/${gameId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setGameInfo(data);
        setPhase(data.status === 'IN_PROGRESS' ? 'in_progress' : 'waiting');
      })
      .catch(() => setErrorMsg('could not load game details'));
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
      setMsRemaining(state.msRemaining);
      seedPlayerState(state.players);
      setPlayers(state.players); // initial paint before the render loop takes over
    });

    socket.on('battle:update', (data) => {
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
      setKillFeed((prev) => [...prev, { id: feedId, text: `${data.killerName} ➔ ${data.victimName}` }]);
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
      const merged = Object.values(metaRef.current).map((m) => {
        if (m.userId === myUserId) {
          const pos = predictedPosRef.current || { x: 0, y: 0 };
          return { ...m, x: pos.x, y: pos.y };
        }
        const pos = getInterpolatedPosition(m.userId, 0, 0);
        return { ...m, x: pos.x, y: pos.y };
      });
      setPlayers(merged);
      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [phase, myUserId]);

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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopFiring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameId, token]);

  if (phase === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'rgba(255,255,255,0.7)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ letterSpacing: '1px', textTransform: 'uppercase', fontSize: '12px' }}>Connecting to lobby...</p>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    const isCreator = gameInfo && myUserId === gameInfo.creatorId;

    return (
      <div style={{
        padding: '32px',
        maxWidth: '560px',
        margin: '60px auto',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        textAlign: 'center'
      }}>
        <button
          onClick={onExit}
          style={{
            marginBottom: '24px',
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.2s',
            outline: 'none'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          ← Leave Lobby
        </button>

        <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.5px' }}>
          {gameInfo ? gameInfo.name : 'Match Arena'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
          {isCreator ? 'You are the host. Start when ready!' : 'Waiting for the host to launch the match...'}
        </p>

        {errorMsg && (
          <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ margin: '24px 0', textAlign: 'left' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Roster ({gameInfo?.participants?.length || 0})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gameInfo && gameInfo.participants.map((p) => {
              const isPlayerHost = p.userId === gameInfo.creatorId;
              return (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: p.userId === myUserId ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${p.userId === myUserId ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: '12px',
                    color: '#e2e8f0',
                    fontWeight: p.userId === myUserId ? 600 : 400
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.userId === myUserId ? '#6366f1' : '#10b981', boxShadow: `0 0 8px ${p.userId === myUserId ? '#6366f1' : '#10b981'}` }} />
                    <span>{p.displayName} {p.userId === myUserId && '(You)'}</span>
                  </div>
                  {isPlayerHost && (
                    <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Host
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isCreator ? (
          <button
            onClick={handleStartMatch}
            style={{
              width: '100%',
              padding: '14px 28px',
              borderRadius: '14px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              border: 'none',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              transition: 'transform 0.15s, opacity 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Launch Match
          </button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b', animation: 'pulse 1.5s infinite' }} />
            <p style={{ color: '#64748b', fontSize: '13px' }}>Waiting for host to launch game...</p>
          </div>
        )}
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
  const facingLeft = Math.cos(aimAngle) < 0;

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1000px', margin: '0 auto', color: '#e2e8f0' }}>
      <style>{`
        @keyframes bullet-fly {
          0% { transform: translate(0px, 0px); }
          100% { transform: translate(var(--dx), var(--dy)); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
        <button
          onClick={onExit}
          style={{
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          ← Leave Match
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 24px',
          borderRadius: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <span style={{ fontSize: '15px', color: '#f1f5f9', fontWeight: 700, letterSpacing: '0.5px' }}>
            ⏱ {minutes}:{seconds}
          </span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '14px', color: '#818cf8', fontWeight: 600 }}>
            KILLS: <strong style={{ color: '#fff', fontSize: '16px' }}>{me ? me.kills : 0}</strong>
          </span>
          {lockedPlayerId && (
            <>
              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 1s infinite' }}>
                🎯 TARGET LOCKED
              </span>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>
          {errorMsg}
        </div>
      )}

      <div
        ref={arenaRef}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => { e.preventDefault(); startFiring(); }}
        onMouseUp={stopFiring}
        onMouseLeave={stopFiring}
        onDoubleClick={(e) => { e.preventDefault(); fireOnce(); }}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${arenaSize.w} / ${arenaSize.h}`,
          background: '#090d16',
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.05) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1.5px, transparent 1.5px)
          `,
          backgroundSize: '40px 40px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1.5px solid rgba(99, 102, 241, 0.15)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7), inset 0 0 40px rgba(99, 102, 241, 0.05)',
          cursor: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          MozUserSelect: 'none'
        }}
      >
        {walls.map((wall, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(wall.x / arenaSize.w) * 100}%`,
              top: `${(wall.y / arenaSize.h) * 100}%`,
              width: `${(wall.width / arenaSize.w) * 100}%`,
              height: `${(wall.height / arenaSize.h) * 100}%`,
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(99, 102, 241, 0.1)',
              pointerEvents: 'none'
            }}
          />
        ))}

        <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${arenaSize.w} ${arenaSize.h}`}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {me && me.hp > 0 && (
            <g>
              <line
                x1={me.x}
                y1={me.y}
                x2={me.x + Math.cos(aimAngle) * 2000}
                y2={me.y + Math.sin(aimAngle) * 2000}
                stroke="#f97316"
                strokeWidth="3.5"
                opacity="0.3"
                strokeDasharray="6 8"
                filter="url(#glow)"
              />
              <line
                x1={me.x}
                y1={me.y}
                x2={me.x + Math.cos(aimAngle) * 2000}
                y2={me.y + Math.sin(aimAngle) * 2000}
                stroke="#f97316"
                strokeWidth="1.2"
                opacity="0.75"
                strokeDasharray="6 8"
              />
            </g>
          )}
          {tracers.map((t) => {
            const dx = t.x2 - t.x1;
            const dy = t.y2 - t.y1;
            const angle = Math.atan2(dy, dx);
            const bulletLength = 35;
            return (
              <g
                key={t.id}
                style={{
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  animation: 'bullet-fly 0.12s linear forwards'
                }}
              >
                <line
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x1 + Math.cos(angle) * bulletLength}
                  y2={t.y1 + Math.sin(angle) * bulletLength}
                  stroke="#f97316"
                  strokeWidth="4.5"
                  opacity="0.8"
                  filter="url(#glow)"
                />
                <line
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x1 + Math.cos(angle) * bulletLength}
                  y2={t.y1 + Math.sin(angle) * bulletLength}
                  stroke="#fff"
                  strokeWidth="1.8"
                  opacity="1"
                />
              </g>
            );
          })}
        </svg>

        {players.map((p) => {
          const isMe = p.userId === myUserId;
          const isTargeted = p.userId === lockedPlayerId;

          return (
            <div
              key={p.userId}
              style={{
                position: 'absolute',
                left: `${(p.x / arenaSize.w) * 100}%`,
                top: `${(p.y / arenaSize.h) * 100}%`,
                transform: 'translate(-50%, -50%)',
                display: p.hp > 0 ? 'flex' : 'none',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                zIndex: isMe ? 10 : 5,
                pointerEvents: 'none'
              }}
            >
              {isTargeted && (
                <div style={{
                  position: 'absolute',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: '2px dashed #ef4444',
                  animation: 'spin 4s linear infinite',
                  top: 'calc(50% + 5px)',
                  transform: 'translateY(-50%)',
                  boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                  pointerEvents: 'none'
                }} />
              )}

              <span style={{
                fontSize: '11px',
                fontWeight: isMe ? '700' : '500',
                color: isMe ? '#818cf8' : '#e2e8f0',
                background: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(4px)',
                border: isMe ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                padding: '2px 8px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
              }}>
                {p.displayName}
              </span>

              <div style={{
                width: '48px',
                height: '6px',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '3px',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)'
              }}>
                <div style={{
                  width: `${p.hp}%`,
                  height: '100%',
                  background: p.hp > 40 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #ef4444, #f87171)',
                  boxShadow: `0 0 6px ${p.hp > 40 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`,
                  transition: 'width 0.15s ease'
                }} />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: isMe && facingLeft ? 'scaleX(-1)' : 'none',
                position: 'relative'
              }}>
                {isMe && (
                  <div style={{
                    position: 'absolute',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
                    zIndex: -1,
                    top: '-4px'
                  }} />
                )}

                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ffdbac',
                  border: '1.5px solid #111827',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  marginBottom: '1px',
                  zIndex: 2
                }} />

                <div style={{
                  width: '18px',
                  height: '16px',
                  borderRadius: '4px',
                  background: isMe ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
                  border: `1.5px solid ${isMe ? '#1e3a8a' : '#7c2d12'}`,
                  boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
                  zIndex: 1
                }} />
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            left: `${cursorPercent.x}%`,
            top: `${cursorPercent.y}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            width: '32px',
            height: '32px',
            transition: 'width 0.15s, height 0.15s'
          }}
        >
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: '2px',
            height: '8px',
            background: lockedPlayerId ? '#ef4444' : '#6366f1',
            transform: 'translateX(-50%)',
            boxShadow: `0 0 6px ${lockedPlayerId ? '#ef4444' : '#6366f1'}`
          }} />
          <div style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            width: '2px',
            height: '8px',
            background: lockedPlayerId ? '#ef4444' : '#6366f1',
            transform: 'translateX(-50%)',
            boxShadow: `0 0 6px ${lockedPlayerId ? '#ef4444' : '#6366f1'}`
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            height: '2px',
            width: '8px',
            background: lockedPlayerId ? '#ef4444' : '#6366f1',
            transform: 'translateY(-50%)',
            boxShadow: `0 0 6px ${lockedPlayerId ? '#ef4444' : '#6366f1'}`
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            right: 0,
            height: '2px',
            width: '8px',
            background: lockedPlayerId ? '#ef4444' : '#6366f1',
            transform: 'translateY(-50%)',
            boxShadow: `0 0 6px ${lockedPlayerId ? '#ef4444' : '#6366f1'}`
          }} />
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: `1px solid ${lockedPlayerId ? 'rgba(239, 68, 68, 0.6)' : 'rgba(99, 102, 241, 0.4)'}`,
            transform: 'translate(-50%, -50%)',
            boxShadow: `inset 0 0 4px ${lockedPlayerId ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`
          }} />
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: lockedPlayerId ? '#ef4444' : '#fff',
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 4px ${lockedPlayerId ? '#ef4444' : '#6366f1'}`
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', gap: '20px' }}>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
          ⌨️ Use <strong style={{ color: '#94a3b8' }}>W, A, S, D</strong> or arrows to move.<br />
          🖱️ Aim with mouse, hold <strong style={{ color: '#94a3b8' }}>Left Click</strong> or <strong style={{ color: '#94a3b8' }}>Spacebar</strong> to fire lasers.
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          alignItems: 'flex-end',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '10px 16px',
          borderRadius: '12px',
          minWidth: '220px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.06)', width: '100%', paddingBottom: '4px', textAlign: 'right' }}>
            Combat Log
          </span>
          {killFeed.length === 0 ? (
            <span style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>System ready...</span>
          ) : (
            killFeed.map((k) => (
              <div key={k.id} style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 500, letterSpacing: '0.2px' }}>
                {k.text}
              </div>
            ))
          )}
        </div>
      </div>

      {me && me.hp <= 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 700,
          boxShadow: '0 8px 30px rgba(239, 68, 68, 0.4)',
          backdropFilter: 'blur(8px)',
          animation: 'pulse 1.5s infinite',
          zIndex: 100
        }}>
          ⚠️ ELIMINATED — RESPAWNING SHORTLY
        </div>
      )}
    </div>
  );
}

export default Battlefield;