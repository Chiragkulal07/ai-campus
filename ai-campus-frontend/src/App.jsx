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

  // Voice + video chat hook — only becomes active once the socket is connected
  const {
    isMicOn, toggleMic,
    isVideoOn, toggleVideo,
    speakingPeerIds,
    remoteVideoStreams,
    localVideoStream,
  } = useVoiceChat(socketReady ? socketRef.current : null);

  useEffect(() => {
    fetch('http://localhost:4000/labs')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => Array.isArray(data) && setLabs(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) { setLoadingMe(false); return; }
    fetch('http://localhost:4000/profile/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setMe(data); setLoadingMe(false); })
      .catch(() => { localStorage.removeItem('token'); setToken(null); setMe(null); setLoadingMe(false); });
  }, [token]);

  useEffect(() => {
    if (!me) return;
    const socket = io('http://localhost:4001');
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

  // ── Loading ──────────────────────────────
  if (loadingMe) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#080c14', fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading campus...</p>
      </div>
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
      background: '#080c14', fontFamily: "'Inter', sans-serif", overflow: 'hidden',
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '56px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(8,12,20,0.95)', backdropFilter: 'blur(10px)',
        position: 'relative', zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>🎓</div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#f1f5f9', letterSpacing: '-0.3px' }}>
           Robo Campus
          </span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '4px' }}>
          {NAV_TABS.map(tab => (
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
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                background: (view === tab.id || (tab.id === 'campus' && isOnCampus))
                  ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: (view === tab.id || (tab.id === 'campus' && isOnCampus))
                  ? '#a5b4fc' : '#64748b',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                outline: (view === tab.id || (tab.id === 'campus' && isOnCampus))
                  ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{me.displayName}</div>
            <div style={{ color: '#475569', fontSize: '11px' }}>
              Lv.{me.profile.level} · {me.profile.xp} XP
            </div>
          </div>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: me.avatar.bodyColor || '#6366f1',
            border: '2px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '13px',
          }}>
            {me.displayName[0].toUpperCase()}
          </div>

          {/* Mic toggle button */}
          <button
            onClick={toggleMic}
            title={isMicOn ? 'Turn microphone off' : 'Turn microphone on'}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMicOn ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              border: isMicOn ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: isMicOn ? '#10b981' : '#64748b',
              fontSize: '16px', cursor: 'pointer',
              boxShadow: isMicOn ? '0 0 0 4px rgba(16,185,129,0.15)' : 'none',
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
              width: '36px', height: '36px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isVideoOn ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: isVideoOn ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: isVideoOn ? '#3b82f6' : '#64748b',
              fontSize: '16px', cursor: 'pointer',
              boxShadow: isVideoOn ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none',
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
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
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
            {view === 'lab' && (
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