import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BUILDING_META = {
  CODING_LAB:     { icon: '💻', name: 'Coding Lab',     accent: '#188c88' },
  INTERVIEW_HALL: { icon: '🎤', name: 'Interview Hall', accent: '#5c4535' },
  LIBRARY:        { icon: '📚', name: 'Library',        accent: '#b08154' },
  EVENT_HALL:     { icon: '🎉', name: 'Event Hall',     accent: '#de9b2a' },
};

const DIFF_PILL = {
  EASY:   { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: '🟢 Easy' },
  MEDIUM: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: '🟡 Medium' },
  HARD:   { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: '🔴 Hard' },
};

function AllChallenges({ token, onEnterChallenge }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const load = () => {
    setLoading(true);
    fetch('http://localhost:4000/challenges')
      .then(r => r.json())
      .then(data => { setChallenges(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not load challenges'); setLoading(false); });
  };

  useEffect(() => {
    load();
    const socket = io('http://localhost:4001');
    socket.on('challenge:created', (c) => setChallenges(prev => [c, ...prev]));
    return () => socket.disconnect();
  }, []);

  const handleJoin = async (challengeId) => {
    setJoiningId(challengeId);
    setError('');
    const res = await fetch(`http://localhost:4000/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setJoiningId(null);
    if (!res.ok) {
      if (data.error === 'you already joined this challenge') { onEnterChallenge(challengeId); return; }
      setError(data.error || 'Could not join challenge');
      return;
    }
    onEnterChallenge(challengeId);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', marginBottom: '6px' }}>
            ⚔️ All Challenges
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Every open challenge across the whole campus, updated live.
          </p>
        </div>
        <button onClick={load} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8', borderRadius: '10px', padding: '8px 14px',
          fontSize: '13px', cursor: 'pointer', fontWeight: 500,
        }}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', borderRadius: '10px', padding: '10px 14px',
          fontSize: '13px', marginBottom: '20px',
        }}>⚠️ {error}</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569', fontSize: '14px' }}>
          Loading challenges...
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)',
          borderRadius: '18px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
          <p style={{ color: '#475569', fontSize: '14px' }}>No open challenges right now. Enter a building to create one!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {challenges.map(c => {
          const meta = BUILDING_META[c.building] || { icon: '🏛️', name: c.building, accent: '#6366f1' };
          const diff = DIFF_PILL[c.difficulty] || DIFF_PILL.EASY;
          const spotsLeft = c.maxParticipants - (c.currentParticipants ?? 0);
          const isFull = spotsLeft <= 0;
          return (
            <div key={c.id} style={{
              background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {/* Building badge */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: meta.accent + '22',
                  border: `1px solid ${meta.accent}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                }}>
                  {meta.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>{c.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      background: diff.bg, color: diff.color, fontWeight: 600,
                    }}>{diff.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>{meta.name}</span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>🏷 {c.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>❓ {c.questionCount}q</span>
                    <span style={{ fontSize: '12px', color: isFull ? '#f87171' : '#475569' }}>
                      👥 {c.currentParticipants ?? 0}/{c.maxParticipants}
                    </span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>by {c.creatorName}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleJoin(c.id)}
                disabled={isFull || joiningId === c.id}
                style={{
                  padding: '9px 20px', borderRadius: '10px', border: 'none', flexShrink: 0,
                  background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: isFull ? '#475569' : 'white', fontWeight: 700, fontSize: '13px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
                }}
              >
                {joiningId === c.id ? '...' : isFull ? 'Full' : '▶ Join'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AllChallenges;