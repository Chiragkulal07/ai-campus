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
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '36px 24px', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes rx-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes rx-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes rx-fadein { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rx-floatfade { 0% { opacity: 0; transform: translateY(4px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      {/* Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.06) 60%, rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: '24px',
        padding: '28px 32px',
        marginBottom: '36px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35), inset 0 0 40px rgba(99,102,241,0.04)',
        position: 'relative', overflow: 'hidden',
        animation: 'rx-fadein 0.5s ease',
      }}>
        {/* BG glow orb */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          width: '68px', height: '68px', borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${me.avatar.bodyColor || '#6366f1'}, ${me.avatar.bodyColor || '#4338ca'})`,
          border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: `0 0 24px ${me.avatar.bodyColor || '#6366f1'}55, 0 0 0 6px rgba(99,102,241,0.1)`,
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
            {justGained !== null && (
              <span style={{
                color: '#34d399', fontSize: '13px', fontWeight: 700,
                animation: 'rx-floatfade 4s ease-out forwards',
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                padding: '3px 10px', borderRadius: '20px',
              }}>
                ✨ +{justGained} XP
              </span>
            )}
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '18px' }}>
            🏆 {me.profile.challengesWon || 0} Wins &nbsp;·&nbsp; 🎮 {me.profile.challengesJoined || 0} Matches
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '8px 14px',
            }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>{totalCorrectAnswers}</span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Correct Answers</span>
            </div>
            <button
              onClick={onOpenSummary}
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.12))',
                border: '1px solid rgba(99,102,241,0.28)',
                borderRadius: '12px', padding: '8px 16px', color: '#a5b4fc',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              📊 My Summary
            </button>
          </div>
        </div>
      </div>

      {/* Buildings Grid */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '3px', height: '16px', background: 'linear-gradient(180deg, #6366f1, #8b5cf6)', borderRadius: '2px' }} />
        <h3 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Campus Sectors
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '44px' }}>
        {Object.entries(BUILDING_META).map(([id, meta]) => (
          <div
            key={id}
            onClick={() => onEnterBuilding(id, id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
            style={{
              background: 'linear-gradient(135deg, rgba(20,30,50,0.6), rgba(13,20,36,0.5))',
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: '18px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
              backdropFilter: 'blur(12px)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = meta.accent;
              e.currentTarget.style.boxShadow = `0 16px 40px ${meta.accent}1a, 0 0 0 1px ${meta.accent}22`;
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: meta.accent + '15',
              border: `1.5px solid ${meta.accent}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              boxShadow: `0 0 20px ${meta.accent}10`,
            }}>{meta.icon}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>
                {id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div style={{
                color: meta.accent, fontSize: '18px', fontWeight: 700,
                transition: 'transform 0.2s',
              }}>→</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', background: 'linear-gradient(180deg, #10b981, #059669)', borderRadius: '2px' }} />
          <div>
            <h3 style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>
              Live Activity
            </h3>
            <p style={{ color: '#334155', fontSize: '12px' }}>Active challenges on campus</p>
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
          <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.07)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'rx-pulse 0.9s linear infinite' }} />
          Loading lobby events…
        </div>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'rgba(13,20,36,0.3)', border: '1.5px dashed rgba(255,255,255,0.06)',
          borderRadius: '20px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>🏕️</div>
          <h4 style={{ color: '#64748b', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Campus is quiet right now</h4>
          <p style={{ color: '#334155', fontSize: '13px' }}>No active challenges open. Enter a building to launch one!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {challenges.map(c => {
          const meta = BUILDING_META[c.building] || { icon: '🏛️', accent: '#6366f1' };
          const diff = DIFF_PILL[c.difficulty] || DIFF_PILL.EASY;
          const isFull = (c.currentParticipants ?? 0) >= c.maxParticipants;
          return (
            <div key={c.id} style={{
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
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${meta.accent}44`; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: isFull ? '#1e293b' : `linear-gradient(180deg, ${meta.accent}, ${meta.accent}88)`,
                borderRadius: '16px 0 0 16px',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, paddingLeft: '6px' }}>
                <span style={{
                  fontSize: '22px', background: meta.accent + '12', padding: '8px',
                  borderRadius: '12px', border: `1px solid ${meta.accent}22`,
                }}>{meta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14.5px', letterSpacing: '-0.2px' }}>{c.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: diff.bg, color: diff.color, border: `1px solid ${diff.border}`, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {diff.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#475569' }}>
                    {c.category.replace(/_/g, ' ')} &nbsp;·&nbsp; 📋 {c.questionCount} Qs &nbsp;·&nbsp; 👥 {c.currentParticipants ?? 0}/{c.maxParticipants} &nbsp;·&nbsp; <strong style={{ color: '#64748b' }}>{c.creatorName}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleJoin(c.id)}
                disabled={isFull || joiningId === c.id}
                style={{
                  padding: '9px 20px', borderRadius: '10px', border: 'none', flexShrink: 0,
                  background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: isFull ? '#334155' : 'white', fontWeight: 700, fontSize: '13px',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {joiningId === c.id ? '…' : isFull ? 'Full' : '⚡ Join'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Reception;
