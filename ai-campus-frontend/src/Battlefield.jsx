import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import MatchResults from './MatchResults';
import { API_URL, SOCKET_URL } from './config';

const FIRE_RATE_MS = 220; // ~4.5 shots per second while held down

function Battlefield({ token, gameId, onExit }) {
  const socketRef = useRef(null);
  const arenaRef = useRef(null);
  const fireIntervalRef = useRef(null);
  const aimAngleRef = useRef(0); // kept in sync with aimAngle state, read by the fire loop
  const mousePosRef = useRef({ x: 0, y: 0 });

  const [myUserId, setMyUserId] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | waiting | in_progress | ended | error
  const [gameInfo, setGameInfo] = useState(null);

  const [arenaSize, setArenaSize] = useState({ w: 1000, h: 800 });
  const [walls, setWalls] = useState([]);
  const [players, setPlayers] = useState([]);
  const [msRemaining, setMsRemaining] = useState(0);
  const [aimAngle, setAimAngle] = useState(0);
  const [cursorPercent, setCursorPercent] = useState({ x: 50, y: 50 }); // for the crosshair overlay
  const [tracers, setTracers] = useState([]);
  const [killFeed, setKillFeed] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [lockedPlayerId, setLockedPlayerId] = useState(null);

  const heldKeys = useRef({ up: false, down: false, left: false, right: false });

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
      setArenaSize({ w: state.arenaWidth, h: state.arenaHeight });
      setPlayers(state.players);
      setMsRemaining(state.msRemaining);
    });

    socket.on('battle:update', (data) => {
      setPlayers(data.players);
      setMsRemaining(data.msRemaining);
    });

    socket.on('battle:shot-fired', (data) => {
      if (data.shooterId === myUserId) return; // Ignore local player shots to prevent duplicate tracers

      setPlayers((currentPlayers) => {
        const shooter = currentPlayers.find((p) => p.userId === data.shooterId);
        if (shooter && data.hitPoint) {
          const tracerId = `${data.shooterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setTracers((prev) => [...prev, { id: tracerId, x1: shooter.x, y1: shooter.y, x2: data.hitPoint.x, y2: data.hitPoint.y }]);
          setTimeout(() => setTracers((prev) => prev.filter((t) => t.id !== tracerId)), 120);
        }
        return currentPlayers;
      });
    });

    socket.on('battle:hit', (data) => {
      setPlayers((currentPlayers) =>
        currentPlayers.map((p) =>
          p.userId === data.targetId ? { ...p, hp: data.newHp } : p
        )
      );
    });

    socket.on('battle:kill', (data) => {
      const feedId = `${data.victimId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setKillFeed((prev) => [...prev, { id: feedId, text: `${data.killerName} ➔ ${data.victimName}` }]);
      setTimeout(() => setKillFeed((prev) => prev.filter((k) => k.id !== feedId)), 4000);

      // Set victim HP to 0 immediately so they disappear on screen
      setPlayers((currentPlayers) =>
        currentPlayers.map((p) =>
          p.userId === data.victimId ? { ...p, hp: 0 } : p
        )
      );
    });

    socket.on('battle:respawn', (data) => {
      // Instantly position the player and set health back to 100
      setPlayers((currentPlayers) =>
        currentPlayers.map((p) =>
          p.userId === data.userId ? { ...p, x: data.x, y: data.y, hp: 100 } : p
        )
      );
    });

    socket.on('battle:match-ended', (data) => {
      setFinalLeaderboard(data.leaderboard);
      setPhase('ended');
    });

    socket.on('game:error', (err) => {
      setErrorMsg(err.message);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, token, phase === 'in_progress', myUserId]);

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

    // Generous snap radius to assist with aiming on target players
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

    // Simple percentage position on screen for crosshair drawing
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

    // Find hit point: if locked, hit the enemy. Otherwise, project 1200px out.
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
    if (fireIntervalRef.current) return; // already firing, don't stack intervals
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

  // ── Loading ──
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

  // ── Waiting room ──
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

  // ── Match ended ──
  if (phase === 'ended') {
    return <MatchResults leaderboard={finalLeaderboard} myUserId={myUserId} onExit={onExit} />;
  }

  // ── Live arena ──
  const secondsLeft = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const me = players.find((p) => p.userId === myUserId);
  const facingLeft = Math.cos(aimAngle) < 0;

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1000px', margin: '0 auto', color: '#e2e8f0' }}>
      <style>{`
        @keyframes bullet-fly {
          0% {
            transform: translate(0px, 0px);
          }
          100% {
            transform: translate(var(--dx), var(--dy));
          }
        }
      `}</style>

      {/* Top HUD bar */}
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

      {/* Main Arena Window */}
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
          // Holographic sci-fi grid deck styling
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
          cursor: 'none', // hide standard mouse cursor
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          MozUserSelect: 'none'
        }}
      >
        {/* Arena obstacles / walls */}
        {walls.map((wall, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(wall.x / arenaSize.w) * 100}%`,
              top: `${(wall.y / arenaSize.h) * 100}%`,
              width: `${(wall.width / arenaSize.w) * 100}%`,
              height: `${(wall.height / arenaSize.h) * 100}%`,
              // Futuristic barrier styling
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(99, 102, 241, 0.1)',
              pointerEvents: 'none'
            }}
          />
        ))}

        {/* Lasers / Bullet Tracers layer */}
        <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${arenaSize.w} ${arenaSize.h}`}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Aiming guideline */}
          {me && me.hp > 0 && (
            <g>
              {/* Outer bright laser guide glow */}
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
              {/* Core guide line */}
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
                {/* Outer glowing plasma streak */}
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
                {/* Core bright bullet hot center */}
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

        {/* Render Players */}
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
              {/* Target lock overlay bracket around enemy */}
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

              {/* Player Tag */}
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

              {/* Health Bar */}
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

              {/* Player Character Avatar Mesh */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: isMe && facingLeft ? 'scaleX(-1)' : 'none',
                position: 'relative'
              }}>
                {/* Local player glow aura */}
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

                {/* Head */}
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

                {/* Body Suit */}
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

        {/* Crosshair — Custom Neon Reticle with responsive lock states */}
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
          {/* Inner ring */}
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
          {/* Central dot */}
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

      {/* Footer Controls & Live Activity Feed */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px', gap: '20px' }}>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
          ⌨️ Use <strong style={{ color: '#94a3b8' }}>W, A, S, D</strong> or arrows to move.<br />
          🖱️ Aim with mouse, hold <strong style={{ color: '#94a3b8' }}>Left Click</strong> or <strong style={{ color: '#94a3b8' }}>Spacebar</strong> to fire lasers.
        </p>

        {/* Floating Glass Kill Feed */}
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

      {/* Down state indicator */}
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