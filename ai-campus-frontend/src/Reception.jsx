import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

function Reception({ me, token, onEnterGamingLab, onEnterBattlefield, onOpenSummary }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [gameStats, setGameStats] = useState({ totalMatches: 0, totalKills: 0 });

  const loadGames = () => {
    setLoading(true);
    fetch(`${API_URL}/games`)
      .then(r => r.json())
      .then(data => {
        setGames(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not reach server');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGames();

    // Fetch user combat summary stats
    fetch(`${API_URL}/profile/me/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.gamingLab) {
          setGameStats(data.gamingLab);
        }
      })
      .catch(() => {});

    const socket = io(SOCKET_URL);
    socket.on('game:created', (newGame) => {
      setGames(prev => [newGame, ...prev]);
    });

    return () => socket.disconnect();
  }, [token]);

  const handleJoinGame = async (gameId) => {
    setJoiningId(gameId);
    setError('');

    try {
      const res = await fetch(`${API_URL}/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setJoiningId(null);

      if (!res.ok) {
        if (data.error === 'you already joined this game') {
          onEnterBattlefield(gameId);
          return;
        }
        setError(data.error || 'Could not join match');
        return;
      }

      onEnterBattlefield(gameId);
    } catch {
      setJoiningId(null);
      setError('Network error joining match');
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '36px 24px', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes rx-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes rx-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes rx-fadein { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 60%, rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(59,130,246,0.22)',
        borderRadius: '24px',
        padding: '28px 32px',
        marginBottom: '36px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(59,130,246,0.04)',
        position: 'relative', overflow: 'hidden',
        animation: 'rx-fadein 0.5s ease',
      }}>
        {/* BG glow orb */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: '68px', height: '68px', borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${me.avatar?.bodyColor || '#3b82f6'}, #1d4ed8)`,
          border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: `0 0 24px ${me.avatar?.bodyColor || '#3b82f6'}55, 0 0 0 6px rgba(59,130,246,0.1)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', fontWeight: 900, color: 'white',
          animation: 'rx-float 3s ease-in-out infinite',
        }}>
          {me.displayName[0].toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Welcome back, {me.displayName} 👋
            </h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            🎖️ Level {me.profile?.level || 1} Combatant &nbsp;·&nbsp; 🕹️ {gameStats.totalMatches} Matches Fought
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '8px 14px',
            }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '16px' }}>{gameStats.totalKills}</span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Total Kills</span>
            </div>

            <button
              onClick={onOpenSummary}
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.12))',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '12px', padding: '8px 16px', color: '#93c5fd',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              📊 Combat Career Summary
            </button>
          </div>
        </div>
      </div>

      {/* Featured Campus Sector */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: 'linear-gradient(180deg, #3b82f6, #60a5fa)', borderRadius: '2px' }} />
        <h3 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Active Campus Sector
        </h3>
      </div>

      <div style={{ marginBottom: '44px' }}>
        <div
          onClick={onEnterGamingLab}
          style={{
            background: 'linear-gradient(135deg, rgba(20,30,50,0.7), rgba(13,20,36,0.6))',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '20px',
            padding: '24px 28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(59,130,246,0.18), 0 0 0 1px rgba(59,130,246,0.3)';
            e.currentTarget.style.transform = 'translateY(-3px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(59,130,246,0.12)',
              border: '1.5px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
              boxShadow: '0 0 20px rgba(59,130,246,0.12)',
            }}>🕹️</div>

            <div>
              <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', marginBottom: '4px' }}>
                Gaming Lab — Combat Simulation Arena
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0 }}>
                Join or host multiplayer 2D laser-combat matches with server-side lag compensation and live rankings.
              </p>
            </div>
          </div>

          <button
            style={{
              padding: '10px 22px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
              pointerEvents: 'none'
            }}
          >
            Enter Arena <span>→</span>
          </button>
        </div>
      </div>

      {/* Live activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', background: 'linear-gradient(180deg, #10b981, #059669)', borderRadius: '2px' }} />
          <div>
            <h3 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>
              Live Arena Matches
            </h3>
            <p style={{ color: '#334155', fontSize: '12px' }}>Open battlefield lobbies ready to fight</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', padding: '5px 12px', borderRadius: '20px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'rx-pulse 1.5s infinite' }} />
          <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>LIVE</span>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
          color: '#fca5a5', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', marginBottom: '18px'
        }}>⚠️ {error}</div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#475569', fontSize: '13.5px', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.07)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'rx-pulse 0.9s linear infinite' }} />
          Loading active lobbies…
        </div>
      )}

      {!loading && games.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'rgba(13,20,36,0.3)', border: '1.5px dashed rgba(255,255,255,0.06)',
          borderRadius: '20px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>🕹️</div>
          <h4 style={{ color: '#64748b', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>No active battle lobbies right now</h4>
          <p style={{ color: '#334155', fontSize: '13px', marginBottom: '16px' }}>Enter the Gaming Lab to create and host a new match!</p>
          <button
            onClick={onEnterGamingLab}
            style={{
              padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.3)',
              background: 'rgba(59,130,246,0.12)', color: '#93c5fd', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Open Gaming Lab Lobby →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {games.map(g => {
          const isFull = (g.currentParticipants ?? 0) >= g.maxPlayers;
          return (
            <div key={g.id} style={{
              background: 'linear-gradient(135deg, rgba(20,30,50,0.5), rgba(13,20,36,0.45))',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '18px',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.18s',
              position: 'relative', overflow: 'hidden',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: isFull ? '#1e293b' : 'linear-gradient(180deg, #3b82f6, #60a5fa)',
                borderRadius: '16px 0 0 16px',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, paddingLeft: '6px' }}>
                <span style={{
                  fontSize: '22px', background: 'rgba(59,130,246,0.1)', padding: '8px',
                  borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)',
                }}>🕹️</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14.5px', letterSpacing: '-0.2px' }}>{g.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {g.durationSec}s Arena
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#475569' }}>
                    👥 {g.currentParticipants ?? 0}/{g.maxPlayers} Fighters &nbsp;·&nbsp; Host: <strong style={{ color: '#94a3b8' }}>{g.creatorName}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleJoinGame(g.id)}
                disabled={isFull || joiningId === g.id}
                style={{
                  padding: '9px 20px', borderRadius: '10px', border: 'none', flexShrink: 0,
                  background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: isFull ? '#334155' : 'white', fontWeight: 700, fontSize: '13px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 4px 14px rgba(59,130,246,0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== g.id) e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { if (!isFull && joiningId !== g.id) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {joiningId === g.id ? '…' : isFull ? 'Full' : '⚡ Join Battle'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Reception;
