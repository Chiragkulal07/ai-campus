import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

const BUILDING_META = {
  CODING_LAB: { icon: '💻', name: 'Coding Lab', accent: '#6366f1' },
  INTERVIEW_HALL: { icon: '🎤', name: 'Interview Hall', accent: '#f59e0b' },
  LIBRARY: { icon: '📚', name: 'Library', accent: '#10b981' },
  EVENT_HALL: { icon: '🎉', name: 'Event Hall', accent: '#ec4899' },
  gaminglab: { icon: '🕹️', name: 'Gaming Lab', accent: '#3b82f6' }
};

const DIFF_PILL = {
  EASY: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.2)', label: 'Easy' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.2)', label: 'Medium' },
  HARD: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.2)', label: 'Hard' },
};

function AllChallenges({ token, onEnterChallenge, onEnterBattlefield }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`${API_URL}/challenges`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API_URL}/games`).then(r => r.ok ? r.json() : Promise.reject())
    ])
      .then(([challengeData, gameData]) => {
        const processedChallenges = (Array.isArray(challengeData) ? challengeData : []).map(c => ({
          ...c,
          isGame: false
        }));
        const processedGames = (Array.isArray(gameData) ? gameData : []).map(g => ({
          ...g,
          building: 'gaminglab',
          category: 'LASER_COMBAT',
          difficulty: 'MEDIUM',
          questionCount: 0,
          maxParticipants: g.maxPlayers,
          isGame: true
        }));
        setChallenges([...processedChallenges, ...processedGames]);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load challenges and games');
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const socket = io(SOCKET_URL);
    socket.on('challenge:created', (c) => {
      setChallenges(prev => [{ ...c, isGame: false }, ...prev]);
    });
    socket.on('game:created', (g) => {
      setChallenges(prev => [
        {
          ...g,
          building: 'gaminglab',
          category: 'LASER_COMBAT',
          difficulty: 'MEDIUM',
          questionCount: 0,
          maxParticipants: g.maxPlayers,
          isGame: true
        },
        ...prev
      ]);
    });
    return () => socket.disconnect();
  }, []);

  const handleJoin = async (item) => {
    setJoiningId(item.id);
    setError('');
    if (item.isGame) {
      const res = await fetch(`${API_URL}/games/${item.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setJoiningId(null);
      if (!res.ok) {
        if (data.error === 'you already joined this game') {
          onEnterBattlefield(item.id);
          return;
        }
        setError(data.error || 'Could not join game');
        return;
      }
      onEnterBattlefield(item.id);
    } else {
      const res = await fetch(`${API_URL}/challenges/${item.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setJoiningId(null);
      if (!res.ok) {
        if (data.error === 'you already joined this challenge') {
          onEnterChallenge(item.id);
          return;
        }
        setError(data.error || 'Could not join challenge');
        return;
      }
      onEnterChallenge(item.id);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '50px 24px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <style>{`@keyframes ac-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
            letterSpacing: '-1px'
          }}>
            ⚔️ Live Simulated Sprints
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14.5px', fontWeight: 500 }}>
            Every active open challenge across the whole campus, synchronized live.
          </p>
        </div>
        <button onClick={load} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8', borderRadius: '12px', padding: '10px 18px',
          fontSize: '13.5px', cursor: 'pointer', fontWeight: 600,
          transition: 'all 0.2s'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          ↻ Fetch Feeds
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', borderRadius: '14px', padding: '14px 18px',
          fontSize: '14px', marginBottom: '24px',
        }}>⚠️ {error}</div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '80px', color: '#64748b', fontSize: '14.5px' }}>
          <div style={{ width: '22px', height: '22px', border: '2.5px solid rgba(255,255,255,0.05)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'ac-spin 0.8s linear infinite' }} />
          Synchronizing simulator grids...
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'rgba(15, 23, 42, 0.2)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '24px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
          <p style={{ color: '#64748b', fontSize: '15px', fontWeight: 500 }}>No active simulator runs found. Connect to a simulator terminal to spin one up!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {challenges.map(c => {
          const meta = BUILDING_META[c.building] || { icon: '🏛️', name: c.building, accent: '#6366f1' };
          const diff = DIFF_PILL[c.difficulty] || DIFF_PILL.EASY;
          const spotsLeft = c.maxParticipants - (c.currentParticipants ?? 0);
          const isFull = spotsLeft <= 0;
          return (
            <div
              key={c.id}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px', padding: '20px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.25s',
                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = meta.accent + '66';
                e.currentTarget.style.boxShadow = `0 12px 35px ${meta.accent}10`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
              }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: isFull ? '#475569' : `linear-gradient(180deg, ${meta.accent}, ${meta.accent}aa)`,
                borderRadius: '20px 0 0 20px'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0, paddingLeft: '6px' }}>
                {/* Building badge */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                  background: meta.accent + '12',
                  border: `1px solid ${meta.accent}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                  boxShadow: `0 0 15px ${meta.accent}08`
                }}>
                  {meta.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '15.5px', letterSpacing: '-0.3px' }}>{c.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '3px 10px', borderRadius: '8px',
                      background: diff.bg, color: diff.color, border: `1px solid ${diff.border}`, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>{diff.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', rowGap: '4px' }}>
                    <span style={{ fontSize: '13px', color: meta.accent, fontWeight: 700 }}>{meta.name}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>🏷️ {c.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>📋 {c.questionCount} Questions</span>
                    <span style={{ fontSize: '13px', color: isFull ? '#f87171' : '#64748b', fontWeight: isFull ? 700 : 500 }}>
                      👥 {c.currentParticipants ?? 0}/{c.maxParticipants}{isFull ? ' (Full)' : ''}
                    </span>
                    <span style={{ fontSize: '13px', color: '#475569' }}>Host: <strong style={{ color: '#94a3b8', fontWeight: 600 }}>{c.creatorName}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleJoin(c)}
                disabled={isFull || joiningId === c.id}
                style={{
                  padding: '11px 24px', borderRadius: '12px', border: 'none', flexShrink: 0,
                  background: isFull ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: isFull ? '#475569' : 'white', fontWeight: 800, fontSize: '13.5px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 6px 16px rgba(16,185,129,0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {joiningId === c.id ? '...' : isFull ? 'Full' : '⚡ Engage'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AllChallenges;