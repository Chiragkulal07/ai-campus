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
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

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
      background: '#04060e',
      backgroundImage: `
        radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, 0.18) 0%, transparent 65%),
        radial-gradient(circle at 80% 70%, rgba(34, 211, 238, 0.12) 0%, transparent 55%),
        radial-gradient(circle at 20% 70%, rgba(168, 85, 247, 0.14) 0%, transparent 55%)
      `,
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
        <div style={{
          position: 'relative',
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 0 40px rgba(139,92,246,0.6), 0 0 20px rgba(56,189,248,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', marginBottom: '24px', margin: '0 auto 24px',
          animation: 'float 2.2s ease-in-out infinite',
        }}>
          🎓
          {/* Subtle Ring */}
          <div style={{
            position: 'absolute', top: '-6px', left: '-6px', right: '-6px', bottom: '-6px',
            borderRadius: '24px', border: '1.5px solid rgba(56, 189, 248, 0.5)',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.6)',
            animation: 'pulse-ring 2s infinite'
          }} />
        </div>
        <div style={{
          width: '220px', height: '4px', background: 'rgba(255,255,255,0.06)',
          borderRadius: '2px', overflow: 'hidden', margin: '0 auto 16px',
        }}>
          <div style={{
            height: '100%', width: '60%',
            background: 'linear-gradient(90deg, #c084fc, #38bdf8, #c084fc)',
            borderRadius: '2px',
            animation: 'shimmer 1.5s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }} />
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Connecting to Voxel Sky Node…
        </p>
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
          style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 20px rgba(139,92,246,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>🎓</div>
          <span style={{ fontWeight: 800, fontSize: '16px', color: '#ffffff', letterSpacing: '-0.3px' }}>
            Robo<span style={{ color: '#38bdf8' }}>Campus</span>
          </span>
        </div>

        {/* Nav tabs */}
        <nav style={{
          display: 'flex', gap: '3px',
          background: 'rgba(15, 23, 42, 0.65)',
          padding: '4px 6px',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)'
        }}>
          {NAV_TABS.map(tab => {
            const isActive = view === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                style={{
                  padding: '7px 15px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid rgba(96, 165, 250, 0.6)' : '1px solid transparent',
                  background: isActive ? 'rgba(30, 58, 138, 0.45)' : 'transparent',
                  color: isActive ? '#93c5fd' : '#94a3b8',
                  boxShadow: isActive ? '0 0 16px rgba(59, 130, 246, 0.4), inset 0 0 10px rgba(59, 130, 246, 0.2)' : 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  letterSpacing: '-0.1px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; } }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          {/* Level chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '5px 12px', borderRadius: '20px',
            background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
            <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 700 }}>Lv.{me.profile?.level || 1}</span>
            <span style={{ color: '#475569', fontSize: '11px' }}>·</span>
            <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>{me.profile?.xp || 0} XP</span>
          </div>

          {/* Avatar button with name & color picker popover */}
          <div
            onClick={() => setShowAvatarPicker(prev => !prev)}
            title="Click to change your avatar color"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              padding: '3px 8px 3px 3px', borderRadius: '20px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${me.avatar?.bodyColor || '#3b82f6'}, ${me.avatar?.bodyColor || '#3b82f6'}88)`,
              border: '2px solid rgba(255,255,255,0.2)',
              boxShadow: `0 0 12px ${me.avatar?.bodyColor || '#3b82f6'}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '13px',
            }}>
              {me.displayName[0].toUpperCase()}
            </div>
            <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {me.displayName}
            </span>
          </div>

          {/* Color Picker Dropdown Popover */}
          {showAvatarPicker && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: '90px',
              zIndex: 100,
              background: 'rgba(10, 16, 28, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: '12px 16px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8), 0 0 20px rgba(99,102,241,0.2)',
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
                  setShowAvatarPicker(false);
                }}
              />
            </div>
          )}

          {/* Audio toggle button in header */}
          <button
            onClick={toggleMic}
            title={isMicOn ? 'Turn microphone off' : 'Turn microphone on'}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMicOn ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
              border: isMicOn ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(255,255,255,0.08)',
              color: isMicOn ? '#10b981' : '#64748b',
              fontSize: '14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isMicOn ? '🎤' : '🔇'}
          </button>

          {/* Calendar / Tasks button */}
          <button
            onClick={() => setView('summary')}
            title="View Summary & Schedule"
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
              fontSize: '14px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            📅
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px', borderRadius: '9px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.2px'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(239,68,68,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
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
          <CampusWorld
            players={players}
            myPlayerId={myPlayerId}
            heldKeys={heldKeys}
            sendMoveInput={sendMoveInput}
            onEnterBuilding={handleEnterBuilding}
            speakingPeerIds={speakingPeerIds}
            remoteVideoStreams={remoteVideoStreams}
            myVideoStream={localVideoStream}
            isMicOn={isMicOn}
            toggleMic={toggleMic}
            isVideoOn={isVideoOn}
            toggleVideo={toggleVideo}
          />
        )}

        {/* Gaming Lab */}
        {view === 'gaminglab' && (
          <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
            <GamingLab
              token={token}
              onEnterBattlefield={handleEnterBattlefield}
            />
          </div>
        )}

        {/* Roadmap Lab */}
        {view === 'roadmaplab' && (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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