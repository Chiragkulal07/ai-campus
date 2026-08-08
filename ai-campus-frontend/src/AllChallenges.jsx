import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BUILDING_META = {
  CODING_LAB:     { icon: '💻', name: 'Coding Lab',     accent: '#6366f1' },
  INTERVIEW_HALL: { icon: '🎤', name: 'Interview Hall', accent: '#f59e0b' },
  LIBRARY:        { icon: '📚', name: 'Library',        accent: '#10b981' },
  EVENT_HALL:     { icon: '🎉', name: 'Event Hall',     accent: '#ec4899' },
};

const DIFF_PILL = {
  EASY:   { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.2)',  label: 'Easy'   },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24', border: 'rgba(245,158,11,0.2)',  label: 'Medium' },
  HARD:   { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.2)',   label: 'Hard'   },
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
      <style>{`@keyframes ac-spin { to { transform: rotate(360deg); } }`}</style>
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '60px', color: '#64748b', fontSize: '14px' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'ac-spin 0.8s linear infinite' }} />
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
            <div
              key={c.id}
              style={{
                background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = meta.accent + '44'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: isFull ? '#475569' : meta.accent,
                borderRadius: '16px 0 0 16px'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, paddingLeft: '8px' }}>
                {/* Building badge */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: meta.accent + '18',
                  border: `1px solid ${meta.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  boxShadow: `0 0 12px ${meta.accent}12`
                }}>
                  {meta.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>{c.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      background: diff.bg, color: diff.color, border: `1px solid ${diff.border}`, fontWeight: 700,
                    }}>{diff.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: meta.accent, fontWeight: 600 }}>{meta.name}</span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>🏷 {c.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>📋 {c.questionCount}q</span>
                    <span style={{ fontSize: '12px', color: isFull ? '#f87171' : '#475569', fontWeight: isFull ? 600 : 400 }}>
                      👥 {c.currentParticipants ?? 0}/{c.maxParticipants}{isFull ? ' (Full)' : ''}
                    </span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>by <strong style={{ color: '#94a3b8' }}>{c.creatorName}</strong></span>
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
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {joiningId === c.id ? '...' : isFull ? 'Full' : '⚡ Join'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AllChallenges;