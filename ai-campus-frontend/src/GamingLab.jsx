import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

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
    fetch('http://localhost:4000/games')
      .then((res) => res.json())
      .then((data) => {
        setGames(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load games — is index.js running?');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGames();

    const socket = io('http://localhost:4001');
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
      const res = await fetch('http://localhost:4000/games', {
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
        setError(data.error || 'Could not create game');
        setCreating(false);
        return;
      }

      setName('');
      setCreating(false);
      setShowCreateForm(false);
      loadGames();
    } catch {
      setError('Could not reach the server');
      setCreating(false);
    }
  };

  const handleJoin = async (gameId) => {
    setJoiningId(gameId);
    setError('');
    const res = await fetch(`http://localhost:4000/games/${gameId}/join`, {
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
      setError(data.error || 'Could not join game');
      return;
    }

    onEnterBattlefield(gameId);
  };

  const formInputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1.5px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease-in-out',
    display: 'block'
  };

  return (
    <div style={{
      minHeight: '100%',
      background: 'transparent',
      fontFamily: "'Inter', sans-serif",
      padding: '32px 24px',
    }}>
      <style>{`
        @keyframes gl-spin { to { transform: rotate(360deg); } }
        @keyframes gl-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.15); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
        }
      `}</style>

      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.2) 100%)',
              border: '1.5px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 0 20px rgba(59,130,246,0.15)'
            }}>🎮</div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Gaming Lab
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                Create a match or join one already open · Respawn after 3 seconds · Match ends at timer zero
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            {[
              { label: 'Open Matches', value: games.length, color: '#3b82f6' },
              { label: 'Damage/Hit', value: '20%', color: '#f59e0b' },
              { label: 'Respawn Timer', value: '3s', color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(15,23,42,0.4)',
                border: `1px solid ${s.color}22`,
                borderRadius: '12px', padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>{s.label}</span>
                <span style={{ color: s.color, fontSize: '13px', fontWeight: 800 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5', borderRadius: '12px', padding: '12px 16px',
            fontSize: '13.5px', marginBottom: '24px',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Create Match Button / Form */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              width: '100%', padding: '15px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              marginBottom: '32px', letterSpacing: '-0.2px',
              boxShadow: '0 6px 20px rgba(59,130,246,0.3)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            🎯 Create New Match
          </button>
        ) : (
          <div style={{
            background: 'rgba(15, 23, 42, 0.35)', border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px', padding: '28px', marginBottom: '32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                🎯 Match Parameters
              </h3>
              <button
                onClick={() => setShowCreateForm(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
              >✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                  Match Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Laser Duel Arena III"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={formInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 10px rgba(59,130,246,0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Max Players (2–8)
                  </label>
                  <input
                    type="number" min="2" max="8" value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  />
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Time Limit (seconds)
                  </label>
                  <input
                    type="number" min="30" max="600" value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                style={{
                  width: '100%', padding: '14px',
                  background: creating ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '14.5px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                  boxShadow: creating ? 'none' : '0 4px 16px rgba(59,130,246,0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!creating) e.currentTarget.style.transform = 'scale(1.01)'; }}
                onMouseLeave={e => { if (!creating) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {creating ? '⏳ Creating arena...' : '🚀 Launch Arena'}
              </button>
            </form>
          </div>
        )}

        {/* Open Matches */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Open Arenas
            {games.length > 0 && (
              <span style={{
                marginLeft: '8px', background: 'rgba(59,130,246,0.12)',
                color: '#93c5fd', fontSize: '12px', padding: '3px 9px',
                borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(59,130,246,0.2)'
              }}>{games.length}</span>
            )}
          </h3>
          <button
            onClick={loadGames}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: '13px', padding: '4px 8px', fontWeight: 600,
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            ↻ Refresh
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'gl-spin 0.8s linear infinite' }} />
            Loading arenas...
          </div>
        )}

        {!loading && games.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '54px 20px',
            background: 'rgba(15, 23, 42, 0.2)', borderRadius: '20px',
            border: '1.5px dashed rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>🎮</div>
            <h4 style={{ color: '#94a3b8', fontSize: '14.5px', fontWeight: 700, marginBottom: '4px' }}>No open arenas</h4>
            <p style={{ color: '#475569', margin: 0, fontSize: '13.5px' }}>
              No matches are running yet. Click above to create one!
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
                  background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  transition: 'border-color 0.2s',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                  position: 'relative', overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: isFull ? '#475569' : 'linear-gradient(180deg, #3b82f6, #6366f1)',
                  borderRadius: '16px 0 0 16px'
                }} />

                <div style={{ flex: 1, minWidth: 0, paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>{g.name}</span>
                    {!isFull && (
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '6px',
                        background: 'rgba(16,185,129,0.12)', color: '#34d399',
                        border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>OPEN</span>
                    )}
                    {isFull && (
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '6px',
                        background: 'rgba(239,68,68,0.12)', color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>FULL</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>⏱ {durationLabel}</span>
                    <span style={{ fontSize: '12.5px', color: isFull ? '#f87171' : '#64748b', fontWeight: isFull ? 600 : 400 }}>
                      👥 {g.currentParticipants ?? 0}/{g.maxPlayers} {isFull ? '(Full)' : `(${spotsLeft} spots left)`}
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>by <strong style={{ color: '#94a3b8' }}>{g.creatorName}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoin(g.id)}
                  disabled={isFull || joiningId === g.id}
                  style={{
                    padding: '10px 20px', borderRadius: '12px', border: 'none', flexShrink: 0,
                    background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    color: isFull ? '#475569' : 'white', fontWeight: 700, fontSize: '13px',
                    cursor: isFull ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    boxShadow: isFull ? 'none' : '0 4px 15px rgba(59,130,246,0.3)',
                    transition: 'all 0.15s',
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
  );
}

export default GamingLab;