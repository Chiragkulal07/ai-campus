import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

function GamingLab({ token, onEnterBattlefield }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [durationSec, setDurationSec] = useState(120);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const loadGames = () => {
    setLoading(true);
    fetch(`${API_URL}/games`)
      .then((res) => res.json())
      .then((data) => {
        setGames(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not reach the gaming hub server');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGames();

    const socket = io(SOCKET_URL);
    socket.on('game:created', (newGame) => {
      setGames((prev) => [newGame, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          maxPlayers: Number(maxPlayers),
          durationSec: Number(durationSec)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create arena match');
        setCreating(false);
        return;
      }

      setName('');
      setCreating(false);
      setShowCreateForm(false);
      loadGames();
    } catch {
      setError('Could not reach the arena server');
      setCreating(false);
    }
  };

  const handleJoin = async (gameId) => {
    setJoiningId(gameId);
    setError('');
    const res = await fetch(`${API_URL}/games/${gameId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
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
  };

  const formInputStyle = {
    width: '100%',
    padding: '13px 16px',
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    display: 'block'
  };

  return (
    <div style={{
      height: '100%',
      minHeight: 0,
      boxSizing: 'border-box',
      background: 'transparent',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      padding: '28px 24px 0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes gl-spin { to { transform: rotate(360deg); } }
        @keyframes gl-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(192, 132, 252, 0.25); }
          50% { box-shadow: 0 0 0 8px rgba(192, 132, 252, 0); }
        }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '840px',
        margin: '0 auto',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header matching Left Island Terminal */}
        <div style={{ marginBottom: '24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3) 0%, rgba(88, 28, 135, 0.4) 100%)',
              border: '2px solid rgba(192, 132, 252, 0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
              boxShadow: '0 0 25px rgba(168, 85, 247, 0.5), inset 0 0 15px rgba(168, 85, 247, 0.3)'
            }}>🎮</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, color: '#ffffff', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px' }}>
                  Gaming Lab
                </h2>
                <span style={{
                  fontSize: '10.5px', fontWeight: 800, color: '#c084fc',
                  letterSpacing: '2px', textTransform: 'uppercase',
                  background: 'rgba(147, 51, 234, 0.18)', border: '1px solid rgba(192, 132, 252, 0.4)',
                  padding: '2px 8px', borderRadius: '6px'
                }}>
                  TERMINAL HUB
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13.5px' }}>
                Multiplayer 2D laser combat with server-side lag compensation and live leaderboard scoring
              </p>
            </div>
          </div>

          {/* Telemetry Stats Strip */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            {[
              { label: 'Active Arenas', value: games.length, color: '#c084fc' },
              { label: 'Hit Damage', value: '20 HP', color: '#38bdf8' },
              { label: 'Respawn Cycle', value: '3.0s', color: '#34d399' },
              { label: 'Tick Interval', value: '100ms', color: '#fde047' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: `1px solid ${s.color}33`,
                borderRadius: '12px', padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: '8px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}`, flexShrink: 0 }} />
                <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>{s.label}:</span>
                <span style={{ color: s.color, fontSize: '13px', fontWeight: 800 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '32px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5', borderRadius: '12px', padding: '14px 18px',
              fontSize: '13.5px', marginBottom: '20px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Create Match Button / Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                width: '100%', padding: '16px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)',
                color: 'white', border: 'none', borderRadius: '16px',
                fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                marginBottom: '28px', letterSpacing: '0.3px',
                boxShadow: '0 8px 25px rgba(124, 58, 237, 0.4), 0 0 20px rgba(6, 182, 212, 0.25)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(124, 58, 237, 0.55), 0 0 25px rgba(6, 182, 212, 0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.4), 0 0 20px rgba(6, 182, 212, 0.25)'; }}
            >
              <span>⚡</span> Spawn & Host New Arena Match
            </button>
          ) : (
            <div style={{
              background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.2) 0%, rgba(15, 23, 42, 0.85) 100%)',
              border: '1.5px solid rgba(192, 132, 252, 0.4)',
              borderRadius: '24px', padding: '28px', marginBottom: '28px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 25px rgba(168, 85, 247, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎯</span> Configure Arena Parameters
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
                >✕</button>
              </div>

              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: '#c084fc', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Match Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Neon Voxel Laser Duel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#c084fc'; e.target.style.boxShadow = '0 0 16px rgba(192, 132, 252, 0.4)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ color: '#38bdf8', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                      Max Pilots (2–8)
                    </label>
                    <input
                      type="number" min="2" max="8" value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                      style={formInputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#38bdf8', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                      Combat Timer (seconds)
                    </label>
                    <input
                      type="number" min="30" max="600" value={durationSec}
                      onChange={(e) => setDurationSec(e.target.value)}
                      style={formInputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    width: '100%', padding: '14px',
                    background: creating
                      ? 'rgba(124, 58, 237, 0.4)'
                      : 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '14.5px', fontWeight: 800, cursor: creating ? 'not-allowed' : 'pointer',
                    boxShadow: creating ? 'none' : '0 6px 20px rgba(124, 58, 237, 0.4)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { if (!creating) e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={e => { if (!creating) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {creating ? '⏳ Deploying Arena Grid...' : '🚀 Launch Arena'}
                </button>
              </form>
            </div>
          )}

          {/* Open Arenas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Active Combat Lobbies
              {games.length > 0 && (
                <span style={{
                  marginLeft: '8px', background: 'rgba(147, 51, 234, 0.2)',
                  color: '#c084fc', fontSize: '12px', padding: '2px 9px',
                  borderRadius: '20px', fontWeight: 800, border: '1px solid rgba(192, 132, 252, 0.35)'
                }}>{games.length}</span>
              )}
            </h3>
            <button
              onClick={loadGames}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8', borderRadius: '8px',
                cursor: 'pointer', fontSize: '12.5px', padding: '5px 12px', fontWeight: 600,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              ↻ Refresh Lobbies
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0', color: '#64748b', fontSize: '14px', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.1)', borderTopColor: '#c084fc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Connecting to arena nodes...
            </div>
          )}

          {!loading && games.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '54px 20px',
              background: 'rgba(11, 17, 33, 0.65)', borderRadius: '20px',
              border: '1.5px dashed rgba(168, 85, 247, 0.25)',
              backdropFilter: 'blur(16px)'
            }}>
              <div style={{ fontSize: '42px', marginBottom: '12px', filter: 'drop-shadow(0 0 16px rgba(192, 132, 252, 0.4))' }}>🎮</div>
              <h4 style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>No active arenas running</h4>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '13.5px' }}>
                Be the first pilot to spawn an arena and challenge others!
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {games.map((g) => {
              const spotsLeft = g.maxPlayers - (g.currentParticipants ?? 0);
              const isFull = spotsLeft <= 0;
              const mins = Math.floor(g.durationSec / 60);
              const secs = g.durationSec % 60;
              const durationLabel = mins > 0 ? `${mins}m ${secs > 0 ? secs + 's' : ''}`.trim() : `${g.durationSec}s`;
              return (
                <div
                  key={g.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 26, 48, 0.65) 0%, rgba(10, 15, 30, 0.75) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px', padding: '16px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                    position: 'relative', overflow: 'hidden',
                    backdropFilter: 'blur(16px)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.5)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.25)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  {/* Left Accent Bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                    background: isFull ? '#334155' : 'linear-gradient(180deg, #c084fc, #38bdf8)',
                    borderRadius: '16px 0 0 16px'
                  }} />

                  <div style={{ flex: 1, minWidth: 0, paddingLeft: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.2px' }}>{g.name}</span>
                      {!isFull && (
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)', color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 800,
                          textTransform: 'uppercase', letterSpacing: '0.6px'
                        }}>OPEN</span>
                      )}
                      {isFull && (
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.15)', color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 800,
                          textTransform: 'uppercase', letterSpacing: '0.6px'
                        }}>FULL</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>⏱ {durationLabel}</span>
                      <span style={{ fontSize: '12.5px', color: isFull ? '#f87171' : '#94a3b8', fontWeight: isFull ? 700 : 500 }}>
                        👥 {g.currentParticipants ?? 0}/{g.maxPlayers} {isFull ? '(Full)' : `(${spotsLeft} spots left)`}
                      </span>
                      <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Host: <strong style={{ color: '#cbd5e1' }}>{g.creatorName}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoin(g.id)}
                    disabled={isFull || joiningId === g.id}
                    style={{
                      padding: '10px 22px', borderRadius: '12px', border: 'none', flexShrink: 0,
                      background: isFull
                        ? 'rgba(255,255,255,0.05)'
                        : 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                      color: isFull ? '#64748b' : 'white', fontWeight: 800, fontSize: '13px',
                      cursor: isFull ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                      boxShadow: isFull ? 'none' : '0 4px 18px rgba(124, 58, 237, 0.45)',
                      transition: 'all 0.15s ease',
                      animation: (!isFull && joiningId !== g.id) ? 'gl-pulse 2s ease-in-out infinite' : 'none'
                    }}
                    onMouseEnter={e => { if (!isFull && joiningId !== g.id) e.currentTarget.style.transform = 'scale(1.04)'; }}
                    onMouseLeave={e => { if (!isFull && joiningId !== g.id) e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {joiningId === g.id ? '⏳ Joining...' : isFull ? 'Full' : '⚡ Join Match'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GamingLab;