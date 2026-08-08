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

  const loadGames = () => {
    setLoading(true);
    fetch('http://localhost:4000/games')
      .then((res) => res.json())
      .then((data) => {
        setGames(data);
        setLoading(false);
      })
      .catch(() => {
        setError('could not load games — is index.js running?');
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
        setError(data.error || 'could not create game');
        setCreating(false);
        return;
      }

      setName('');
      setCreating(false);
      loadGames();
    } catch (err) {
      setError('could not reach the server');
      setCreating(false);
    }
  };

  const handleJoin = async (gameId) => {
    setError('');
    const res = await fetch(`http://localhost:4000/games/${gameId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      // Already joined? Just take them back in rather than blocking them.
      if (data.error === 'you already joined this game') {
        onEnterBattlefield(gameId);
        return;
      }
      setError(data.error || 'could not join game');
      return;
    }

    onEnterBattlefield(gameId);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', color: '#e2e8f0' }}>
      <h2 style={{ color: '#f1f5f9' }}>Gaming Lab</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginTop: '-8px' }}>
        Create a match, or join one already open. Everyone spawns with the same gun —
        20% damage per hit, respawn after 3 seconds, match ends when the timer runs out.
      </p>

      <h3 style={{ color: '#f1f5f9', fontSize: '15px' }}>Create a Match</h3>
      <form onSubmit={handleCreate} style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Match name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', color: '#64748b' }}>Max players</label>
            <input
              type="number"
              min="2"
              max="8"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', color: '#64748b' }}>Time limit (seconds)</label>
            <input
              type="number"
              min="30"
              max="600"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={creating}
          style={{
            padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)',
            color: '#a5b4fc', fontWeight: 600
          }}
        >
          {creating ? 'Creating...' : 'Create Match'}
        </button>
      </form>

      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      <h3 style={{ color: '#f1f5f9', fontSize: '15px' }}>Open Matches</h3>
      {loading && <p style={{ color: '#64748b' }}>Loading...</p>}
      {!loading && games.length === 0 && (
        <p style={{ color: '#64748b' }}>No open matches right now — create one above.</p>
      )}

      {games.map((g) => (
        <div
          key={g.id}
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)'
          }}
        >
          <div>
            <strong style={{ color: '#f1f5f9' }}>{g.name}</strong>
            <br />
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {g.currentParticipants ?? 0}/{g.maxPlayers} joined · {g.durationSec}s match · by {g.creatorName}
            </span>
          </div>
          <button
            onClick={() => handleJoin(g.id)}
            style={{
              padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
              color: '#10b981', fontWeight: 600
            }}
          >
            Join
          </button>
        </div>
      ))}
    </div>
  );
}

export default GamingLab;