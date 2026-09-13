import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './Login';
import AvatarPicker from './AvatarPicker';
import Reception from './Reception';
import CampusWorld from './CampusWorld';
import useVoiceChat from './Usevoicechat';
import GamingLab from './GamingLab';
import Battlefield from './Battlefield';
import SummaryGrid from './SummaryGrid';
import SummaryDetail from './SummaryDetail';
import { API_URL, SOCKET_URL } from './config';
import RoadmapLab from './RoadmapLab';

const NAV_TABS = [
  { id: 'reception', label: '🏠 Reception' },
  { id: 'campus', label: '🗺️ Campus' },
  { id: 'gaminglab', label: '🕹️ Gaming Lab' },
  { id: 'roadmaplab', label: '🧭 Roadmap Lab' },
  { id: 'summary', label: '📊 Summary' },
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('campus');
  const [activeGameId, setActiveGameId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef(null);
  const heldKeys = useRef({ up: false, down: false, left: false, right: false });
  const [summaryDetailLabel, setSummaryDetailLabel] = useState(null);

  // Voice + video chat hook — only becomes active once the socket is connected
  const {
    isMicOn, toggleMic,
    isVideoOn, toggleVideo,
    speakingPeerIds,
    remoteVideoStreams,
    localVideoStream,
  } = useVoiceChat(socketReady ? socketRef.current : null);

  useEffect(() => {
    if (!token) { setLoadingMe(false); return; }
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setMe(data); setLoadingMe(false); })
      .catch(() => { localStorage.removeItem('token'); setToken(null); setMe(null); setLoadingMe(false); });
  }, [token]);

  useEffect(() => {
    if (!token || !me || !me.id) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('connect', () => {
      setMyPlayerId(socket.id);
      setSocketReady(true);
      socket.emit('identify', { displayName: me.displayName, bodyColor: me.avatar?.bodyColor || 'dodgerblue' });
    });
    socket.on('world-snapshot', setPlayers);
    socket.on('player-joined', (p) => setPlayers(prev => [...prev, p]));
    socket.on('world-update', setPlayers);
    socket.on('player-left', (id) => setPlayers(prev => prev.filter(p => p.id !== id)));

    return () => {
      setSocketReady(false);
      setMyPlayerId(null);
      setPlayers([]);
      socket.disconnect();
    };
  }, [token, me?.id]);

  const sendMoveInput = () => {
    if (!socketRef.current) return;
    const dx = (heldKeys.current.right ? 1 : 0) - (heldKeys.current.left ? 1 : 0);
    const dy = (heldKeys.current.down ? 1 : 0) - (heldKeys.current.up ? 1 : 0);
    socketRef.current.emit('move-input', { dx, dy });
  };

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') heldKeys.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') heldKeys.current.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') heldKeys.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') heldKeys.current.right = true;
      sendMoveInput();
    };
    const up = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') heldKeys.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') heldKeys.current.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') heldKeys.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') heldKeys.current.right = false;
      sendMoveInput();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [token]);

  useEffect(() => {
    const resetMovement = () => {
      heldKeys.current = { up: false, down: false, left: false, right: false };
      sendMoveInput();
    };

    window.addEventListener('blur', resetMovement);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetMovement();
    });

    return () => {
      window.removeEventListener('blur', resetMovement);
      document.removeEventListener('visibilitychange', resetMovement);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
    if (socketRef.current) socketRef.current.disconnect();
  };

  const handleEnterGamingLab = () => {
    setView('gaminglab');
  };

  const handleEnterBuilding = (buildingId) => {
    if (buildingId === 'roadmaplab') {
      setView('roadmaplab');
    } else {
      setView('gaminglab');
    }
  };

  const handleEnterBattlefield = (gameId) => {
    setActiveGameId(gameId);
    setView('battlefield');
  };

  const handleOpenSummaryDetail = (type, buildingId, label) => {
    setSummaryDetailLabel(label);
    setView('summarydetail');
  };

  // ── Loading ──────────────────────────────
  if (loadingMe) return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#060a12',
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.06) 0%, transparent 60%)',
    }}>
      <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          boxShadow: '0 0 40px rgba(59,130,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', marginBottom: '24px', margin: '0 auto 24px',
          animation: 'float 2s ease-in-out infinite',
        }}>🎓</div>
        <div style={{
          width: '200px', height: '3px', background: 'rgba(255,255,255,0.06)',
          borderRadius: '2px', overflow: 'hidden', margin: '0 auto 16px',
        }}>
          <div style={{
            height: '100%', width: '60%',
            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            borderRadius: '2px',
            animation: 'shimmer 1.5s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }} />
        </div>
        <p style={{ color: '#475569', fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px' }}>Initializing campus…</p>
      </div>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );

  // ── Login ────────────────────────────────
  if (!token || !me) return <Login onLoginSuccess={(t) => setToken(t)} />;

  // ── Battlefield (full takeover) ───
  if (view === 'battlefield') return (
    <Battlefield
      token={token}
      gameId={activeGameId}
      onExit={() => setView('gaminglab')}
    />
  );

  const isOnCampus = view === 'campus';

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#060a12', overflow: 'hidden',
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: '60px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(6,10,18,0.97)', backdropFilter: 'blur(20px)',
        position: 'relative', zIndex: 50,
        boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.3)',
      }}>
        {/* Top gradient accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), rgba(99,102,241,0.5), transparent)',
        }} />

        {/* Logo */}
        <div
          onClick={() => setView('campus')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 0 16px rgba(59,130,246,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', flexShrink: 0,
          }}>🎓</div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#f1f5f9', letterSpacing: '-0.3px' }}>
            Robo<span style={{ color: '#60a5fa' }}>Campus</span>
          </span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {NAV_TABS.map(tab => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                style={{
                  padding: '6px 14px', borderRadius: '9px', border: 'none',
                  background: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                  color: isActive ? '#93c5fd' : '#4b5563',
                  fontSize: '13px', fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                  transition: 'all 0.18s',
                  outline: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  letterSpacing: isActive ? '-0.1px' : '0',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#4b5563'; }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Level chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
            <span style={{ color: '#94a3b8', fontSize: '11.5px', fontWeight: 600 }}>Lv.{me.profile?.level || 1}</span>
            <span style={{ color: '#334155', fontSize: '11px' }}>·</span>
            <span style={{ color: '#64748b', fontSize: '11px' }}>{me.profile?.xp || 0} XP</span>
          </div>

          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${me.avatar?.bodyColor || '#3b82f6'}, ${me.avatar?.bodyColor || '#3b82f6'}88)`,
              border: '2px solid rgba(255,255,255,0.12)',
              boxShadow: `0 0 12px ${me.avatar?.bodyColor || '#3b82f6'}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '14px',
            }}>
              {me.displayName[0].toUpperCase()}
            </div>
          </div>

          <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {me.displayName}
          </span>

          {/* Mic toggle button */}
          <button
            onClick={toggleMic}
            title={isMicOn ? 'Turn microphone off' : 'Turn microphone on'}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMicOn ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
              border: isMicOn ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(255,255,255,0.07)',
              color: isMicOn ? '#10b981' : '#475569',
              fontSize: '15px', cursor: 'pointer',
              boxShadow: isMicOn ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none',
              animation: isMicOn ? 'micPulse 1.6s ease-in-out infinite' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isMicOn ? '🎤' : '🔇'}
          </button>

          {/* Video toggle button */}
          <button
            onClick={toggleVideo}
            title={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isVideoOn ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              border: isVideoOn ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)',
              color: isVideoOn ? '#3b82f6' : '#475569',
              fontSize: '15px', cursor: 'pointer',
              boxShadow: isVideoOn ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
              animation: isVideoOn ? 'videoPulse 1.6s ease-in-out infinite' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isVideoOn ? '📹' : '📷'}
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          >
            Logout
          </button>
        </div>
      </header>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(16,185,129,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(16,185,129,0.05); }
        }
        @keyframes videoPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.05); }
        }
      `}</style>

      {/* Main content area */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Reception */}
        {view === 'reception' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <Reception
              me={me}
              token={token}
              onEnterGamingLab={handleEnterGamingLab}
              onEnterBattlefield={handleEnterBattlefield}
              onOpenSummary={() => setView('summary')}
            />
          </div>
        )}

        {/* Summary Grid */}
        {view === 'summary' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <SummaryGrid
              token={token}
              onOpenDetail={handleOpenSummaryDetail}
              onBack={() => setView('reception')}
            />
          </div>
        )}

        {/* Summary Detail */}
        {view === 'summarydetail' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <SummaryDetail
              token={token}
              label={summaryDetailLabel}
              onBack={() => setView('summary')}
            />
          </div>
        )}

        {/* Campus map */}
        {isOnCampus && (
          <>
            {/* Avatar picker HUD on campus */}
            <div style={{
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, background: 'rgba(8,12,20,0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px', padding: '10px 16px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <AvatarPicker
                token={token}
                currentColor={me.avatar?.bodyColor || 'dodgerblue'}
                onUpdated={(newAvatar) => {
                  setMe(prev => ({ ...prev, avatar: newAvatar }));
                  if (socketRef.current) {
                    socketRef.current.emit('identify', {
                      displayName: me.displayName,
                      bodyColor: newAvatar.bodyColor,
                    });
                  }
                }}
              />
            </div>

            <CampusWorld
              players={players}
              myPlayerId={myPlayerId}
              heldKeys={heldKeys}
              sendMoveInput={sendMoveInput}
              onEnterBuilding={handleEnterBuilding}
              speakingPeerIds={speakingPeerIds}
              remoteVideoStreams={remoteVideoStreams}
              myVideoStream={localVideoStream}
            />
          </>
        )}

        {/* Gaming Lab */}
        {view === 'gaminglab' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <GamingLab
              token={token}
              onEnterBattlefield={handleEnterBattlefield}
            />
          </div>
        )}

        {/* Roadmap Lab */}
        {view === 'roadmaplab' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <RoadmapLab
              token={token}
              onExit={() => setView('campus')}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;