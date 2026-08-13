import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

function CodingLab({ token, onEnterChallenge }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('MCQ_SPRINT');
  const [difficulty, setDifficulty] = useState('EASY');
  const [questionCount, setQuestionCount] = useState(3);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const DIFFICULTY_COLORS = {
    EASY: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.2)' },
    MEDIUM: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
    HARD: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.2)' },
  };

  const loadChallenges = () => {
    setLoading(true);
    fetch(`${API_URL}/challenges`)
      .then((res) => res.json())
      .then((data) => {
        setChallenges(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load challenges — is index.js running?');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadChallenges();

    const socket = io(SOCKET_URL);
    socket.on('challenge:created', (newChallenge) => {
      setChallenges((prev) => [newChallenge, ...prev]);
    });

    return () => socket.disconnect();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/challenges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          category,
          difficulty,
          questionCount: Number(questionCount),
          maxParticipants: Number(maxParticipants)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create challenge');
        setCreating(false);
        return;
      }

      setName('');
      setCreating(false);
      setShowCreateForm(false);
      loadChallenges();
    } catch {
      setError('Could not reach the server');
      setCreating(false);
    }
  };

  const handleJoin = async (challengeId) => {
    setJoiningId(challengeId);
    setError('');
    const res = await fetch(`${API_URL}/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    setJoiningId(null);

    if (!res.ok) {
      if (data.error === 'you already joined this challenge') {
        onEnterChallenge(challengeId);
        return;
      }
      setError(data.error || 'Could not join challenge');
      return;
    }

    onEnterChallenge(challengeId);
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
      fontFamily: "'Inter', sans-serif",
      padding: '32px 24px',
    }}>
      <style>{`
        @keyframes cl-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.2) 100%)',
              border: '1.5px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 0 20px rgba(99,102,241,0.15)'
            }}>💻</div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Coding Lab
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                Create coding challenges, MCQ sprints, DSA battles, and SQL duels
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            {[
              { label: 'Open Challenges', value: challenges.length, color: '#6366f1' },
              { label: 'Categories', value: '3', color: '#8b5cf6' },
              { label: 'Difficulty Tiers', value: '3', color: '#a78bfa' },
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

        {/* Create Challenge Button / Form */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              width: '100%', padding: '15px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              marginBottom: '32px', letterSpacing: '-0.2px',
              boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            ＋ Launch New Challenge Session
          </button>
        ) : (
          <div style={{
            background: 'rgba(15, 23, 42, 0.35)', border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px', padding: '28px', marginBottom: '32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                Challenge Parameters
              </h3>
              <button
                onClick={() => setShowCreateForm(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
              >✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                  Challenge Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. MCQ Sprint Room 3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={formInputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 10px rgba(99,102,241,0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  >
                    <option value="MCQ_SPRINT" style={{ background: '#0f172a' }}>MCQ Sprint</option>
                    <option value="DSA_BATTLE" style={{ background: '#0f172a' }}>DSA Battle</option>
                    <option value="SQL_CHALLENGE" style={{ background: '#0f172a' }}>SQL Challenge</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  >
                    <option value="EASY" style={{ background: '#0f172a' }}>🟢 Easy</option>
                    <option value="MEDIUM" style={{ background: '#0f172a' }}>🟡 Medium</option>
                    <option value="HARD" style={{ background: '#0f172a' }}>🔴 Hard</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Questions (1–8)
                  </label>
                  <input
                    type="number" min="1" max="8" value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  />
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
                    Max Participants
                  </label>
                  <input
                    type="number" min="1" max="20" value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    style={formInputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                style={{
                  width: '100%', padding: '14px',
                  background: creating ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  fontSize: '14.5px', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer',
                  boxShadow: creating ? 'none' : '0 4px 16px rgba(16,185,129,0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!creating) e.currentTarget.style.transform = 'scale(1.01)'; }}
                onMouseLeave={e => { if (!creating) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {creating ? '⏳ Creating session node...' : '🚀 Launch Session Node'}
              </button>
            </form>
          </div>
        )}

        {/* Open Challenges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Active Sessions
            {challenges.length > 0 && (
              <span style={{
                marginLeft: '8px', background: 'rgba(99,102,241,0.12)',
                color: '#a5b4fc', fontSize: '12px', padding: '3px 9px',
                borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.2)'
              }}>{challenges.length}</span>
            )}
          </h3>
          <button
            onClick={loadChallenges}
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
            <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cl-spin 0.8s linear infinite' }} />
            Loading active sessions...
          </div>
        )}

        {!loading && challenges.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '54px 20px',
            background: 'rgba(15, 23, 42, 0.2)', borderRadius: '20px',
            border: '1.5px dashed rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>📡</div>
            <h4 style={{ color: '#94a3b8', fontSize: '14.5px', fontWeight: 700, marginBottom: '4px' }}>Lobby is empty</h4>
            <p style={{ color: '#475569', margin: 0, fontSize: '13.5px' }}>
              No challenge sessions are running. Create one above!
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {challenges.map((c) => {
            const diff = DIFFICULTY_COLORS[c.difficulty] || DIFFICULTY_COLORS.EASY;
            const spotsLeft = c.maxParticipants - (c.currentParticipants ?? 0);
            const isFull = spotsLeft <= 0;
            return (
              <div
                key={c.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  transition: 'border-color 0.2s',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                  position: 'relative', overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: isFull ? '#475569' : 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                  borderRadius: '16px 0 0 16px'
                }} />

                <div style={{ flex: 1, minWidth: 0, paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>{c.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      background: diff.bg, color: diff.text, border: `1px solid ${diff.border}`, fontWeight: 700,
                    }}>{c.difficulty}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>🏷️ {c.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>📋 {c.questionCount} Questions</span>
                    <span style={{ fontSize: '12.5px', color: isFull ? '#f87171' : '#64748b', fontWeight: isFull ? 600 : 400 }}>
                      👥 {c.currentParticipants ?? 0}/{c.maxParticipants} {isFull ? '(Full)' : `(${spotsLeft} spots left)`}
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>by <strong style={{ color: '#94a3b8' }}>{c.creatorName}</strong></span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(c.id)}
                  disabled={isFull || joiningId === c.id}
                  style={{
                    padding: '10px 20px', borderRadius: '12px', border: 'none', flexShrink: 0,
                    background: isFull ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: isFull ? '#475569' : 'white', fontWeight: 700, fontSize: '13px',
                    cursor: isFull ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    boxShadow: isFull ? 'none' : '0 4px 15px rgba(16,185,129,0.3)',
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
    </div>
  );
}

export default CodingLab;