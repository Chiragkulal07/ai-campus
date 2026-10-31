import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useFx from './useFx';
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
import RoadmapLab from './RoadmapLab';
import { API_URL, SOCKET_URL } from './config';
import { initialOf } from './utils';
import {
  IconHome, IconMap, IconGamepad, IconRoute, IconChart,
  IconMic, IconMicOff, IconLogout, IconChevronDown, IconGrad,
} from './icons';

const NAV_TABS = [
  { id: 'campus', label: 'Campus', Icon: IconMap },
  { id: 'reception', label: 'Dashboard', Icon: IconHome },
  { id: 'gaminglab', label: 'Gaming Lab', Icon: IconGamepad },
  { id: 'roadmaplab', label: 'Roadmap Lab', Icon: IconRoute },
  { id: 'summary', label: 'Stats', Icon: IconChart, matches: ['summary', 'summarydetail'] },
];

const KEY_TO_DIR = {
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right',
};

const VIEW_LABELS = {
  campus: 'Campus',
  reception: 'Dashboard',
  gaminglab: 'Gaming Lab',
  roadmaplab: 'Roadmap Lab',
  summary: 'Stats',
  summarydetail: 'Match history',
};

const EMPTY_KEYS = () => ({ up: false, down: false, left: false, right: false });

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('campus');
  const [activeGameId, setActiveGameId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [summaryDetailLabel, setSummaryDetailLabel] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const socketRef = useRef(null);
  const heldKeys = useRef(EMPTY_KEYS());
  const viewRef = useRef(view);
  const menuRef = useRef(null);
  const navRef = useRef(null);
  const navIndicatorRef = useRef(null);

  useFx();

  // Slide the nav indicator under the active tab (direct DOM, no re-render).
  useLayoutEffect(() => {
    const nav = navRef.current;
    const ind = navIndicatorRef.current;
    if (!nav || !ind) return undefined;
    const place = () => {
      const active = nav.querySelector('.nav-tab.is-active');
      if (!active) { ind.classList.remove('is-ready'); return; }
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.transform = `translateX(${active.offsetLeft}px)`;
      ind.classList.add('is-ready');
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  const [history, setHistory] = useState([]); // previously visited views, most recent last

  const {
    isMicOn, toggleMic,
    isVideoOn, toggleVideo,
    speakingPeerIds,
    remoteVideoStreams,
    localVideoStream,
  } = useVoiceChat(socketReady ? socketRef.current : null);

  // ── Session ──────────────────────────────
  useEffect(() => {
    if (!token) { setLoadingMe(false); return; }
    setLoadingMe(true);
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => { setMe(data); setLoadingMe(false); })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setMe(null);
        setLoadingMe(false);
      });
  }, [token]);

  // ── Campus presence socket ───────────────
  useEffect(() => {
    if (!token || !me?.id) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('connect', () => {
      setMyPlayerId(socket.id);
      setSocketReady(true);
      socket.emit('identify', { token, displayName: me.displayName, bodyColor: me.avatar?.bodyColor || 'dodgerblue' });
    });
    socket.on('world-snapshot', setPlayers);
    socket.on('player-joined', (p) => setPlayers((prev) => [...prev.filter((x) => x.id !== p.id), p]));
    socket.on('world-update', setPlayers);
    socket.on('player-left', (id) => setPlayers((prev) => prev.filter((p) => p.id !== id)));

    return () => {
      setSocketReady(false);
      setMyPlayerId(null);
      setPlayers([]);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, me?.id]);

  // ── Movement input ───────────────────────
  const sendMoveInput = useCallback(() => {
    if (!socketRef.current) return;
    const k = heldKeys.current;
    const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    socketRef.current.emit('move-input', { dx, dy });
  }, []);

  const resetMovement = useCallback(() => {
    const k = heldKeys.current;
    const wasMoving = k.up || k.down || k.left || k.right;
    heldKeys.current = EMPTY_KEYS();
    if (wasMoving) sendMoveInput();
  }, [sendMoveInput]);

  // Stop the campus avatar whenever we leave the campus view, so it does not
  // keep walking while you are in another screen.
  useEffect(() => {
    viewRef.current = view;
    if (view !== 'campus') resetMovement();
  }, [view, resetMovement]);

  useEffect(() => {
    const handle = (e, pressed) => {
      // Campus movement only applies on the campus view, and never while typing.
      if (viewRef.current !== 'campus' || isTypingTarget(e.target)) return;
      const dir = KEY_TO_DIR[e.key.toLowerCase()];
      if (!dir) return;
      if (e.key.startsWith('Arrow')) e.preventDefault();
      if (heldKeys.current[dir] === pressed) return; // ignore key-repeat
      heldKeys.current[dir] = pressed;
      sendMoveInput();
    };
    const down = (e) => handle(e, true);
    const up = (e) => handle(e, false);
    const onVisibility = () => { if (document.hidden) resetMovement(); };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', resetMovement);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', resetMovement);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sendMoveInput, resetMovement]);

  // ── User menu: close on outside click / Escape ──
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Navigate and remember where we came from, so Back returns there.
  const navigate = (next) => {
    if (next === view) return;
    if (view !== 'battlefield') setHistory((h) => [...h, view].slice(-30));
    setView(next);
  };

  // Most recent previous view that is not the current one.
  const prevIndex = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] !== view && history[i] !== 'battlefield') return i;
    }
    return -1;
  })();
  const previousView = prevIndex >= 0 ? history[prevIndex] : null;

  const goBack = (fallback = 'campus') => {
    setHistory(history.slice(0, Math.max(0, prevIndex)));
    setView(previousView || fallback);
  };

  const backLabel = (fallback = 'campus') => `Back to ${VIEW_LABELS[previousView || fallback]}`;

  const handleLogout = () => {
    localStorage.removeItem('token');
    setMenuOpen(false);
    setHistory([]);
    setView('campus');
    setActiveGameId(null);
    setToken(null);
    setMe(null);
  };

  // Re-read the profile so level/XP reflect a match that just finished.
  const refreshMe = () => {
    if (!token) return;
    fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.id) setMe(data); })
      .catch(() => {});
  };

  const handleEnterBuilding = (buildingId) => {
    navigate(buildingId === 'roadmaplab' ? 'roadmaplab' : 'gaminglab');
  };

  const handleEnterBattlefield = (gameId) => {
    setActiveGameId(gameId);
    navigate('battlefield');
  };

  const handleOpenSummaryDetail = (_type, _buildingId, label) => {
    setSummaryDetailLabel(label);
    navigate('summarydetail');
  };

  // ── Loading ──────────────────────────────
  if (loadingMe) {
    return (
      <div className="splash">
        <div className="brand-mark splash-mark" style={{ width: 40, height: 40, borderRadius: 10 }}>
          <IconGrad size={20} />
        </div>
        <div className="row"><span className="spinner" /> Loading your session…</div>
      </div>
    );
  }

  // ── Login ────────────────────────────────
  if (!token || !me) return <Login onLoginSuccess={(t) => setToken(t)} />;

  // ── Battlefield (full takeover) ──────────
  if (view === 'battlefield') {
    return (
      <Battlefield
        token={token}
        gameId={activeGameId}
        onExit={() => { refreshMe(); setView('gaminglab'); }}
      />
    );
  }

  const bodyColor = me.avatar?.bodyColor || '#f59e0b';

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => navigate('campus')} aria-label="RoboCampus home">
          <span className="brand-mark"><IconGrad size={16} /></span>
          <span className="brand-name">RoboCampus</span>
        </button>

        <nav className="app-nav" aria-label="Main" ref={navRef}>
          <span className="nav-indicator" ref={navIndicatorRef} aria-hidden="true" />
          {NAV_TABS.map(({ id, label, Icon, matches }) => {
            const isActive = matches ? matches.includes(view) : view === id;
            return (
              <button
                key={id}
                type="button"
                className={`nav-tab ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(id)}
                title={label}
              >
                <Icon size={15} />
                <span className="nav-tab-label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          <div className="level-chip" title="Level and experience">
            <strong>Level {me.profile?.level || 1}</strong>
            <span className="dim">·</span>
            <span>{me.profile?.xp || 0} XP</span>
          </div>

          <button
            type="button"
            className={`icon-btn ${isMicOn ? 'is-on' : ''}`}
            onClick={toggleMic}
            title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={isMicOn}
          >
            {isMicOn ? <IconMic size={16} /> : <IconMicOff size={16} />}
          </button>

          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="user-trigger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="avatar" style={{ background: bodyColor }}>{initialOf(me.displayName)}</span>
              <span className="user-trigger-name truncate">{me.displayName}</span>
              <IconChevronDown size={14} />
            </button>

            {menuOpen && (
              <div className="menu" role="menu">
                <div className="menu-header">
                  <div className="truncate" style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{me.displayName}</div>
                  {me.email && <div className="truncate dim" style={{ fontSize: 12.5 }}>{me.email}</div>}
                </div>
                <div className="menu-section">
                  <div className="menu-label">Avatar color</div>
                  <AvatarPicker
                    token={token}
                    currentColor={me.avatar?.bodyColor || 'dodgerblue'}
                    onUpdated={(newAvatar) => {
                      if (!newAvatar) return;
                      setMe((prev) => ({ ...prev, avatar: newAvatar }));
                      socketRef.current?.emit('identify', {
                        token,
                        displayName: me.displayName,
                        bodyColor: newAvatar.bodyColor,
                      });
                    }}
                  />
                </div>
                <button type="button" role="menuitem" className="menu-item is-danger" onClick={handleLogout}>
                  <IconLogout size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div key={view} className="view-stage">
        {view === 'reception' && (
          <div className="app-scroll">
            <Reception
              me={me}
              token={token}
              onEnterGamingLab={() => navigate('gaminglab')}
              onEnterRoadmapLab={() => navigate('roadmaplab')}
              onEnterBattlefield={handleEnterBattlefield}
              onOpenSummary={() => navigate('summary')}
              onBack={() => goBack('campus')}
              backLabel={backLabel('campus')}
            />
          </div>
        )}

        {view === 'summary' && (
          <div className="app-scroll">
            <SummaryGrid
              token={token}
              onOpenDetail={handleOpenSummaryDetail}
              onBack={() => goBack('reception')}
              backLabel={backLabel('reception')}
            />
          </div>
        )}

        {view === 'summarydetail' && (
          <div className="app-scroll">
            <SummaryDetail
              token={token}
              label={summaryDetailLabel}
              onBack={() => goBack('summary')}
              backLabel={backLabel('summary')}
            />
          </div>
        )}

        {view === 'campus' && (
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

        {view === 'gaminglab' && (
          <div className="app-scroll">
            <GamingLab
              token={token}
              onEnterBattlefield={handleEnterBattlefield}
              onBack={() => goBack('campus')}
              backLabel={backLabel('campus')}
            />
          </div>
        )}

        {view === 'roadmaplab' && (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <RoadmapLab token={token} onExit={() => goBack('campus')} backLabel={backLabel('campus')} />
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default App;
