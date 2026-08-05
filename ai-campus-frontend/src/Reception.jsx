import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BUILDING_META = {
  CODING_LAB:     { icon: '💻', accent: '#188c88' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#5c4535' },
  LIBRARY:        { icon: '📚', accent: '#b08154' },
  EVENT_HALL:     { icon: '🎉', accent: '#de9b2a' },
};

const DIFF_PILL = {
  EASY:   { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Easy' },
  MEDIUM: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Medium' },
  HARD:   { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Hard' },
};

function Reception({ me, token, onEnterBuilding, onEnterChallenge }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  // Local copy of the correct-answers total, seeded from `me` and updated
  // live when a challenge finishes — without this, the number would only
  // ever reflect whatever it was when the page first loaded.
  const [totalCorrectAnswers, setTotalCorrectAnswers] = useState(me.profile.totalCorrectAnswers || 0);
  const [justGained, setJustGained] = useState(null); // e.g. "+3" flash after a challenge

  const load = () => {
    setLoading(true);
    fetch('http://localhost:4000/challenges')
      .then(r => r.json())
      .then(data => { setChallenges(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not reach server'); setLoading(false); });
  };

  useEffect(() => {
    load();
    const socket = io('http://localhost:4001');

    socket.on('connect', () => {
      // Subscribe to this user's own profile-stat updates so this screen's
      // correct-answers count stays live even for challenges finishing
      // while the user is back here browsing, not in the challenge room.
      socket.emit('user:register', { token });
    });

    socket.on('challenge:created', (c) => setChallenges(prev => [c, ...prev]));

    socket.on('profile:stats-updated', (update) => {
      setTotalCorrectAnswers(update.totalCorrectAnswers);
      if (update.correctAnswers > 0) {
        setJustGained(update.correctAnswers);
        setTimeout(() => setJustGained(null), 4000);
      }
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      setError(data.error || 'Could not join');
      return;
    }
    onEnterChallenge(challengeId);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Inter', sans-serif" }}>

      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '20px', padding: '28px 32px', marginBottom: '36px',
        display: 'flex', alignItems: 'center', gap: '20px',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
          background: me.avatar.bodyColor || '#6366f1',
          border: '3px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', fontWeight: 800, color: 'white',
        }}>
          {me.displayName[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 800, marginBottom: '2px' }}>
            Welcome back, {me.displayName} 👋
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>
            {me.profile.challengesWon || 0} wins · {me.profile.challengesJoined || 0} challenges joined
          </p>

          {/* Correct-answers stat, replacing the old level/XP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '6px 14px',
            }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>
                {totalCorrectAnswers}
              </span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>correct answers</span>
            </div>

            {justGained !== null && (
              <span style={{
                color: '#34d399', fontSize: '13px', fontWeight: 700,
                animation: 'floatUpFade 4s ease-out forwards',
              }}>
                +{justGained} just now
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Buildings */}
      <h3 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
        Buildings
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
        {Object.entries(BUILDING_META).map(([id, meta]) => (
          <div
            key={id}
            onClick={() => onEnterBuilding(id, id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
            style={{
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', padding: '18px 20px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = meta.accent + '55'; e.currentTarget.style.background = 'rgba(15,23,42,1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(15,23,42,0.8)'; }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: meta.accent + '22', border: `1px solid ${meta.accent}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            }}>{meta.icon}</div>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>
                {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div style={{ color: meta.accent, fontSize: '12px', fontWeight: 500, marginTop: '2px' }}>
                Enter →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h3 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>
            Live Activity Board
          </h3>
          <p style={{ color: '#475569', fontSize: '12px' }}>Every open challenge across campus</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px',
        }}>⚠️ {error}</div>
      )}

      {loading && <p style={{ color: '#475569', fontSize: '14px' }}>Loading...</p>}

      {!loading && challenges.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)',
          borderRadius: '16px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏕️</div>
          <p style={{ color: '#475569', fontSize: '14px' }}>No open challenges yet. Enter a building to start one!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {challenges.map(c => {
          const meta = BUILDING_META[c.building] || { icon: '🏛️', accent: '#6366f1' };
          const diff = DIFF_PILL[c.difficulty] || DIFF_PILL.EASY;
          const isFull = (c.currentParticipants ?? 0) >= c.maxParticipants;
          return (
            <div key={c.id} style={{
              background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '5px', background: diff.bg, color: diff.color, fontWeight: 600 }}>
                      {diff.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#475569' }}>
                    {c.category.replace(/_/g, ' ')} · {c.questionCount}q · {c.currentParticipants ?? 0}/{c.maxParticipants} joined · by {c.creatorName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleJoin(c.id)}
                disabled={isFull || joiningId === c.id}
                style={{
                  padding: '8px 18px', borderRadius: '10px', border: 'none', flexShrink: 0,
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes floatUpFade {
          0% { opacity: 0; transform: translateY(4px); }
          15% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default Reception;