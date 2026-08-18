import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './Login';
import AvatarPicker from './AvatarPicker';
import Labs from './Labs';
import Lab from './Lab';
import AllChallenges from './AllChallenges';
import ChallengeRoom from './ChallengeRoom';
import Reception from './Reception';
import CampusWorld from './CampusWorld';
import useVoiceChat from './Usevoicechat';
import GamingLab from './GamingLab';
import Battlefield from './Battlefield';
import SummaryGrid from './SummaryGrid';
import SummaryDetail from './SummaryDetail';
import InterviewHall from './InterviewHall';
import { API_URL, SOCKET_URL } from './config';

const NAV_TABS = [
  { id: 'reception', label: '🏠 Reception' },
  { id: 'campus', label: '🗺️ Campus' },
  { id: 'labs', label: '🏛️ Labs' },
  { id: 'allchallenges', label: '⚔️ All Challenges' },
];

const getCategoryOptionsFor = (buildingId) => {
  switch (buildingId) {
    case 'CODING_LAB':
      return [
        { value: 'MCQ_SPRINT', label: 'MCQ Sprint' },
        { value: 'DSA_BATTLE', label: 'DSA Battle' },
        { value: 'SQL_CHALLENGE', label: 'SQL Challenge' },
      ];
    case 'INTERVIEW_HALL':
      return [
        { value: 'MOCK_HR', label: 'Mock HR Interview' },
        { value: 'TECHNICAL_INTERVIEW', label: 'Technical Interview' },
      ];
    case 'LIBRARY':
      return [{ value: 'DOCUMENT_QUIZ', label: 'Document Quiz' }];
    case 'EVENT_HALL':
      return [{ value: 'HACKATHON', label: 'Hackathon' }];
    default:
      return [{ value: 'GENERAL', label: 'General' }];
  }
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('campus');
  const [activeGameId, setActiveGameId] = useState(null);
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [activeBuildingId, setActiveBuildingId] = useState(null);
  const [activeBuildingName, setActiveBuildingName] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [labs, setLabs] = useState([]);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef(null);
  const heldKeys = useRef({ up: false, down: false, left: false, right: false });
  const [summaryDetailType, setSummaryDetailType] = useState(null);
  const [summaryDetailBuilding, setSummaryDetailBuilding] = useState(null);
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
    fetch(`${API_URL}/labs`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data)) {
          // Filter to only display Interview Hall
          setLabs(data.filter(lab => lab.id === 'INTERVIEW_HALL'));
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!token) { setLoadingMe(false); return; }
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setMe(data); setLoadingMe(false); })
      .catch(() => { localStorage.removeItem('token'); setToken(null); setMe(null); setLoadingMe(false); });
  }, [token]);

  useEffect(() => {
    if (!me) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('connect', () => {
      setMyPlayerId(socket.id);
      setSocketReady(true);
      socket.emit('identify', { displayName: me.displayName, bodyColor: me.avatar.bodyColor });
    });
    socket.on('world-snapshot', setPlayers);
    socket.on('player-joined', (p) => setPlayers(prev => [...prev, p]));
    socket.on('world-update', setPlayers);
    socket.on('player-left', (id) => setPlayers(prev => prev.filter(p => p.id !== id)));
    return () => {
      setSocketReady(false);
      socket.disconnect();
    };
  }, [me]);

  const sendMoveInput = () => {
    if (!socketRef.current) return;
    const dx = (heldKeys.current.right ? 1 : 0) - (heldKeys.current.left ? 1 : 0);
    const dy = (heldKeys.current.down ? 1 : 0) - (heldKeys.current.up ? 1 : 0);
    socketRef.current.emit('move-input', { dx, dy });
  };

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowUp') heldKeys.current.up = true;
      if (e.key === 'ArrowDown') heldKeys.current.down = true;
      if (e.key === 'ArrowLeft') heldKeys.current.left = true;
      if (e.key === 'ArrowRight') heldKeys.current.right = true;
      sendMoveInput();
    };
    const up = (e) => {
      if (e.key === 'ArrowUp') heldKeys.current.up = false;
      if (e.key === 'ArrowDown') heldKeys.current.down = false;
      if (e.key === 'ArrowLeft') heldKeys.current.left = false;
      if (e.key === 'ArrowRight') heldKeys.current.right = false;
      sendMoveInput();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [me]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
    if (socketRef.current) socketRef.current.disconnect();
  };

  const handleEnterBuilding = (buildingId, buildingName) => {
    setActiveBuildingId(buildingId);
    setActiveBuildingName(buildingName);
    setView('lab');
  };

  const handleSelectLab = (labId, labName) => {
    if (labId === 'gaminglab') {
      setView('gaminglab');
    } else {
      handleEnterBuilding(labId, labName);
    }
  };

  const handleEnterChallenge = (challengeId) => {
    setActiveChallengeId(challengeId);
    setView('challenge');
  };

  const handleEnterBattlefield = (gameId) => {
    setActiveGameId(gameId);
    setView('battlefield');
  };

  const handleBackToMap = () => {
    setActiveBuildingId(null);
    setActiveBuildingName(null);
    setView('campus');
  };

  const handleOpenSummaryDetail = (type, buildingId, label) => {
    setSummaryDetailType(type);
    setSummaryDetailBuilding(buildingId);
    setSummaryDetailLabel(label);
    setView('summarydetail');
  };

  // ── Loading ──────────────────────────────
  if (loadingMe) return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#060a12',
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 60%)',
    }}>
      <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)',
          boxShadow: '0 0 40px rgba(99,102,241,0.4)',
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
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
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

  // ── Challenge Room (full takeover) ───────
  if (view === 'challenge') return (
    <ChallengeRoom
      token={token}
      myUserId={me.id}
      challengeId={activeChallengeId}
      onExit={() => setView('lab')}
    />
  );

  // ── Battlefield (full takeover, own screen, no nav bar while fighting) ───
  if (view === 'battlefield') return (
    <Battlefield
      token={token}
      gameId={activeGameId}
      onExit={() => setView('gaminglab')}
    />
  );

  const isOnCampus = view === 'campus' || view === 'lab';

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
        {/* Subtle top gradient line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(139,92,246,0.5), transparent)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)',
            boxShadow: '0 0 16px rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', flexShrink: 0,
          }}>🎓</div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#f1f5f9', letterSpacing: '-0.3px' }}>
            Robo<span style={{ color: '#818cf8' }}>Campus</span>
          </span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {NAV_TABS.map(tab => {
            const isActive = view === tab.id || (tab.id === 'campus' && isOnCampus);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!['campus', 'lab'].includes(tab.id)) {
                    setActiveBuildingId(null);
                    setActiveBuildingName(null);
                  }
                  setView(tab.id);
                }}
                style={{
                  padding: '6px 14px', borderRadius: '9px', border: 'none',
                  background: isActive ? 'rgba(99,102,241,0.18)' : 'transparent',
                  color: isActive ? '#a5b4fc' : '#4b5563',
                  fontSize: '13px', fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                  transition: 'all 0.18s',
                  outline: isActive ? '1px solid rgba(99,102,241,0.28)' : '1px solid transparent',
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
          {/* XP chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f1' }} />
            <span style={{ color: '#94a3b8', fontSize: '11.5px', fontWeight: 600 }}>Lv.{me.profile.level}</span>
            <span style={{ color: '#334155', fontSize: '11px' }}>·</span>
            <span style={{ color: '#64748b', fontSize: '11px' }}>{me.profile.xp} XP</span>
          </div>

          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${me.avatar.bodyColor || '#6366f1'}, ${me.avatar.bodyColor || '#6366f1'}88)`,
              border: '2px solid rgba(255,255,255,0.12)',
              boxShadow: `0 0 12px ${me.avatar.bodyColor || '#6366f1'}44`,
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
              onEnterBuilding={handleEnterBuilding}
              onEnterChallenge={handleEnterChallenge}
              onOpenSummary={() => setView('summary')}
            />
          </div>
        )}

        {/* Summary Grid */}
        {/* Summary grid */}
        {view === 'summary' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <SummaryGrid
              token={token}
              onOpenDetail={handleOpenSummaryDetail}
              onBack={() => setView('reception')}
            />
          </div>
        )}

        {/* Summary detail */}
        {view === 'summarydetail' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <SummaryDetail
              token={token}
              type={summaryDetailType}
              buildingId={summaryDetailBuilding}
              label={summaryDetailLabel}
              onBack={() => setView('summary')}
            />
          </div>
        )}

        {/* Campus + Lab overlay */}
        {isOnCampus && (
          <>
            {/* Avatar picker HUD on campus */}
            {view === 'campus' && (
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
                  currentColor={me.avatar.bodyColor}
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
            )}

            <CampusWorld
              labs={labs}
              players={players}
              myPlayerId={myPlayerId}
              heldKeys={heldKeys}
              sendMoveInput={sendMoveInput}
              onEnterBuilding={handleSelectLab}
              speakingPeerIds={speakingPeerIds}
              remoteVideoStreams={remoteVideoStreams}
              myVideoStream={localVideoStream}
            />

            {/* Lab modal overlaid on campus */}
                        {/* Lab modal overlaid on campus — Interview Hall gets its own dedicated flow */}
            {view === 'lab' && activeBuildingId === 'INTERVIEW_HALL' && (
              <InterviewHall
                token={token}
                onBackToMap={handleBackToMap}
              />
            )}
            {view === 'lab' && activeBuildingId !== 'INTERVIEW_HALL' && (
              <Lab
                token={token}
                buildingId={activeBuildingId}
                buildingName={activeBuildingName}
                categoryOptions={getCategoryOptionsFor(activeBuildingId)}
                onEnterChallenge={handleEnterChallenge}
                onBackToMap={handleBackToMap}
              />
            )}
          </>
        )}

        {/* Labs list */}
        {view === 'labs' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <Labs
              labs={labs}
              onSelectLab={handleSelectLab}
            />
          </div>
        )}

        {/* All Challenges */}
        {view === 'allchallenges' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <AllChallenges
              token={token}
              onEnterChallenge={handleEnterChallenge}
              onEnterBattlefield={handleEnterBattlefield}
            />
          </div>
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
      </main>
    </div>
  );
}

export default App;