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
    <div style={{
      maxWidth: '1020px',
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <style>{`
        @keyframes rx-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes rx-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes rx-fadein { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Hero Welcome Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.25) 0%, rgba(15, 23, 42, 0.75) 50%, rgba(14, 116, 144, 0.25) 100%)',
        border: '1.5px solid rgba(168, 85, 247, 0.35)',
        borderRadius: '24px',
        padding: '32px 36px',
        marginBottom: '36px',
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(168, 85, 247, 0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'rx-fadein 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Ambient Top Glow Line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #c084fc, #38bdf8, transparent)',
        }} />

        {/* Character Avatar with Voxel Ring */}
        <div style={{
          width: '74px', height: '74px', borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${me.avatar?.bodyColor || '#38bdf8'}, #1e1b4b)`,
          border: '2.5px solid rgba(255,255,255,0.25)',
          boxShadow: `0 0 28px ${me.avatar?.bodyColor || '#38bdf8'}66, 0 0 0 8px rgba(168, 85, 247, 0.15)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '30px', fontWeight: 900, color: 'white',
          animation: 'rx-float 3.5s ease-in-out infinite',
        }}>
          {me.displayName[0].toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>
              Welcome back, {me.displayName} 👋
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '4px 0 20px 0' }}>
            🎖️ Level {me.profile?.level || 1} Pilot &nbsp;·&nbsp; 🕹️ {gameStats.totalMatches} Matches Fought &nbsp;·&nbsp; 🎯 {gameStats.totalKills} Laser Frags
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '8px 16px',
            }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '16px' }}>{gameStats.totalKills}</span>
              <span style={{ color: '#94a3b8', fontSize: '12.5px' }}>Total Kills</span>
            </div>

            <button
              onClick={onOpenSummary}
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '12px', padding: '9px 18px', color: '#c084fc',
                fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#c084fc';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(192, 132, 252, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              📊 View Combat Career Summary
            </button>
          </div>
        </div>
      </div>

      {/* Featured Campus Sectors */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '4px', height: '18px', background: 'linear-gradient(180deg, #c084fc, #38bdf8)', borderRadius: '2px' }} />
        <h3 style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Active Floating Sectors
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '44px' }}>
        {/* Gaming Lab Sector Card */}
        <div
          onClick={onEnterGamingLab}
          style={{
            background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid rgba(192, 132, 252, 0.35)',
            borderRadius: '20px',
            padding: '24px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
            position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#c084fc';
            e.currentTarget.style.boxShadow = '0 18px 45px rgba(168, 85, 247, 0.35), 0 0 20px rgba(192, 132, 252, 0.2)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.35)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '54px', height: '54px', borderRadius: '16px',
              background: 'rgba(147, 51, 234, 0.18)',
              border: '1.5px solid rgba(192, 132, 252, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.35)',
            }}>🎮</div>

            <div>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '17px', letterSpacing: '-0.3px', marginBottom: '2px' }}>
                Gaming Lab — Arena Hub
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                Host or fight in 2D laser matches with live lag compensation and rankings.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{
              padding: '8px 18px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
              color: 'white', fontWeight: 700, fontSize: '12.5px',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}>
              Enter Gaming Island <span>→</span>
            </span>
          </div>
        </div>

        {/* Roadmap Lab Sector Card */}
        <div
          onClick={onEnterGamingLab}
          style={{
            background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid rgba(34, 211, 238, 0.35)',
            borderRadius: '20px',
            padding: '24px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
            position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#22d3ee';
            e.currentTarget.style.boxShadow = '0 18px 45px rgba(34, 211, 238, 0.35), 0 0 20px rgba(34, 211, 238, 0.2)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.35)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '54px', height: '54px', borderRadius: '16px',
              background: 'rgba(6, 182, 212, 0.18)',
              border: '1.5px solid rgba(34, 211, 238, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.35)',
            }}>🗺️</div>

            <div>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '17px', letterSpacing: '-0.3px', marginBottom: '2px' }}>
                Roadmap Lab — Skill Graph
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                Explore AI-generated curriculum roadmaps with prerequisite graph dependencies.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{
              padding: '8px 18px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7, #0891b2)',
              color: 'white', fontWeight: 700, fontSize: '12.5px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}>
              Explore Roadmap Island <span>→</span>
            </span>
          </div>
        </div>
      </div>

      {/* Live Activity Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '4px', height: '18px', background: 'linear-gradient(180deg, #10b981, #06b6d4)', borderRadius: '2px' }} />
          <div>
            <h3 style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
              Live Arena Matches
            </h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', margin: '2px 0 0 0' }}>Active battlefield lobbies ready for combat</p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
          padding: '5px 14px', borderRadius: '20px', boxShadow: '0 0 12px rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'rx-pulse 1.4s infinite' }} />
          <span style={{ color: '#34d399', fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.8px' }}>LIVE NODE</span>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5', borderRadius: '12px', padding: '14px 18px', fontSize: '13.5px', marginBottom: '18px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0', color: '#64748b', fontSize: '14px', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.1)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading active sky island lobbies…
        </div>
      )}

      {!loading && games.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'rgba(11, 17, 33, 0.65)', border: '1.5px dashed rgba(168, 85, 247, 0.25)',
          borderRadius: '24px', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '44px', marginBottom: '14px', filter: 'drop-shadow(0 0 16px rgba(192, 132, 252, 0.4))' }}>🕹️</div>
          <h4 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No active battle lobbies right now</h4>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', marginBottom: '20px' }}>Enter the Gaming Lab to spawn and host a new laser battle match!</p>
          <button
            onClick={onEnterGamingLab}
            style={{
              padding: '10px 24px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.4)',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(6, 182, 212, 0.3))',
              color: '#ffffff', fontSize: '13.5px', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 4px 18px rgba(124, 58, 237, 0.3)'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Open Gaming Lab Lobby →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {games.map(g => {
          const isFull = (g.currentParticipants ?? 0) >= g.maxPlayers;
          return (
            <div key={g.id} style={{
              background: 'linear-gradient(135deg, rgba(20, 26, 48, 0.65) 0%, rgba(10, 15, 30, 0.75) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              backdropFilter: 'blur(16px)',
              transition: 'all 0.2s ease',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)'
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Left Accent Bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: isFull ? '#334155' : 'linear-gradient(180deg, #c084fc, #38bdf8)',
                borderRadius: '16px 0 0 16px',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, paddingLeft: '8px' }}>
                <span style={{
                  fontSize: '22px', background: 'rgba(147, 51, 234, 0.15)', padding: '10px',
                  borderRadius: '12px', border: '1px solid rgba(192, 132, 252, 0.3)',
                }}>🕹️</span>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '15px', letterSpacing: '-0.2px' }}>{g.name}</span>
                    <span style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      {g.durationSec}s Arena
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                    👥 {g.currentParticipants ?? 0}/{g.maxPlayers} Pilots &nbsp;·&nbsp; Host: <strong style={{ color: '#cbd5e1' }}>{g.creatorName}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleJoinGame(g.id)}
                disabled={isFull || joiningId === g.id}
                style={{
                  padding: '10px 22px', borderRadius: '12px', border: 'none', flexShrink: 0,
                  background: isFull
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                  color: isFull ? '#64748b' : 'white', fontWeight: 800, fontSize: '13px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 4px 18px rgba(124, 58, 237, 0.45)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== g.id) e.currentTarget.style.transform = 'scale(1.04)'; }}
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
