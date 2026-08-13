import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

const BUILDING_META = {
  CODING_LAB: { icon: '💻', accent: '#6366f1' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#f59e0b' },
  LIBRARY: { icon: '📚', accent: '#10b981' },
  EVENT_HALL: { icon: '🎉', accent: '#ec4899' },
};

const DIFF_PILL = {
  EASY: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.2)', label: 'Easy' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.2)', label: 'Medium' },
  HARD: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.2)', label: 'Hard' },
};

function Reception({ me, token, onEnterBuilding, onEnterChallenge, onOpenSummary }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const [totalCorrectAnswers, setTotalCorrectAnswers] = useState(me.profile.totalCorrectAnswers || 0);
  const [justGained, setJustGained] = useState(null);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/challenges`)
      .then(r => r.json())
      .then(data => { setChallenges(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not reach server'); setLoading(false); });
  };

  useEffect(() => {
    load();
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
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
    const res = await fetch(`${API_URL}/challenges/${challengeId}/join`, {
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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Inter', sans-serif" }}>

      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '24px',
        padding: '32px',
        marginBottom: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(99,102,241,0.05)'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
          background: me.avatar.bodyColor || '#6366f1',
          border: '2px solid rgba(99,102,241,0.4)',
          boxShadow: `0 0 20px ${me.avatar.bodyColor || '#6366f1'}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', fontWeight: 800, color: 'white',
        }}>
          {me.displayName[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.5px' }}>
            Welcome back, {me.displayName} 👋
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', marginBottom: '16px', fontWeight: 500 }}>
            🏆 {me.profile.challengesWon || 0} Wins &nbsp;·&nbsp; 🎮 {me.profile.challengesJoined || 0} Matches Joined
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '8px 16px',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.02)'
            }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                {totalCorrectAnswers}
              </span>
              <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>Correct Answers</span>
            </div>
            <button
              onClick={onOpenSummary}
              style={{
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '12px', padding: '9px 16px', color: '#a5b4fc',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}
            >
              📊 My Summary
            </button>

            {justGained !== null && (
              <span style={{
                color: '#34d399', fontSize: '13.5px', fontWeight: 700,
                animation: 'floatUpFade 4s ease-out forwards',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                ✨ +{justGained} Stats
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Buildings */}
      <h3 style={{ color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' }}>
        Campus Sectors
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '48px' }}>
        {Object.entries(BUILDING_META).map(([id, meta]) => (
          <div
            key={id}
            onClick={() => onEnterBuilding(id, id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
            style={{
              background: 'rgba(15,23,42,0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = meta.accent;
              e.currentTarget.style.boxShadow = `0 12px 30px ${meta.accent}1f`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: meta.accent + '15',
              border: `1.5px solid ${meta.accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
              boxShadow: `0 0 15px ${meta.accent}12`
            }}>{meta.icon}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>
                {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div style={{ color: meta.accent, fontSize: '13px', fontWeight: 700 }}>
                Enter →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3 style={{ color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>
            Live Activity Board
          </h3>
          <p style={{ color: '#475569', fontSize: '13px' }}>Browse and join live challenges currently active on campus</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: '20px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>LIVE DECK</span>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', borderRadius: '12px', padding: '12px 16px', fontSize: '13.5px', marginBottom: '20px'
        }}>⚠️ {error}</div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', gap: '8px', alignItems: 'center' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
          Loading lobby events...
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: 'rgba(15,23,42,0.2)', border: '1.5px dashed rgba(255,255,255,0.05)',
          borderRadius: '24px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏕️</div>
          <h4 style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Campus is quiet right now</h4>
          <p style={{ color: '#475569', fontSize: '13.5px' }}>No active challenges are currently open. Enter a building to launch one!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {challenges.map(c => {
          const meta = BUILDING_META[c.building] || { icon: '🏛️', accent: '#6366f1' };
          const diff = DIFF_PILL[c.difficulty] || DIFF_PILL.EASY;
          const isFull = (c.currentParticipants ?? 0) >= c.maxParticipants;
          return (
            <div key={c.id} style={{
              background: 'rgba(15,23,42,0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              transition: 'border-color 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                <span style={{ fontSize: '24px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>{meta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '15px', letterSpacing: '-0.3px' }}>{c.name}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: diff.bg, color: diff.color, border: `1px solid ${diff.border}`, fontWeight: 700 }}>
                      {diff.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                    {c.category.replace(/_/g, ' ')} &nbsp;·&nbsp; 📋 {c.questionCount} Questions &nbsp;·&nbsp; 👥 {c.currentParticipants ?? 0}/{c.maxParticipants} Joined &nbsp;·&nbsp; by <strong style={{ color: '#94a3b8' }}>{c.creatorName}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleJoin(c.id)}
                disabled={isFull || joiningId === c.id}
                style={{
                  padding: '10px 20px', borderRadius: '12px', border: 'none', flexShrink: 0,
                  background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: isFull ? '#475569' : 'white', fontWeight: 700, fontSize: '13px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 4px 15px rgba(16,185,129,0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {joiningId === c.id ? '...' : isFull ? 'Full' : 'Join Match'}
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