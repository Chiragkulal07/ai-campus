import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from './config';

const LAB_ICONS = {
  CODING_LAB: '💻',
  INTERVIEW_HALL: '🎤',
  LIBRARY: '📚',
  EVENT_HALL: '🎉',
};

const DIFFICULTY_COLORS = {
  EASY: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.2)' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
  HARD: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.2)' },
};

function Lab({ token, buildingId, buildingName, categoryOptions, onEnterChallenge, onBackToMap }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]?.value || '');
  const [difficulty, setDifficulty] = useState('EASY');
  const [questionCount, setQuestionCount] = useState(3);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const labIcon = LAB_ICONS[buildingId] || '🏛️';

  const loadChallenges = () => {
    setLoading(true);
    fetch(`${API_URL}/challenges?building=${buildingId}`)
      .then((res) => res.json())
      .then((data) => {
        setChallenges(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load challenges. Is the backend running?');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadChallenges();
    const socket = io(SOCKET_URL);
    socket.on('challenge:created', (newChallenge) => {
      if (newChallenge.building === buildingId) {
        setChallenges((prev) => [newChallenge, ...prev]);
      }
    });
    return () => socket.disconnect();
  }, [buildingId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          building: buildingId,
          category,
          difficulty,
          questionCount: Number(questionCount),
          maxParticipants: Number(maxParticipants),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create challenge');
        setCreating(false);
        return;
      }

      setName('');
      setShowCreateForm(false);
      setCreating(false);
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
      headers: { Authorization: `Bearer ${token}` },
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
      position: 'fixed', inset: 0, background: 'rgba(4, 7, 17, 0.85)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(16px)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
        borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 40px 100px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(255, 255, 255, 0.02)',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 36px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              fontSize: '32px', width: '56px', height: '56px',
              background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px',
              border: '1.5px solid rgba(255, 255, 255, 0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {labIcon}
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                {buildingName}
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px', marginTop: '2px', fontWeight: 500 }}>
                Configure a new virtual workspace or connect to an active one.
              </p>
            </div>
          </div>
          {onBackToMap && (
            <button
              onClick={onBackToMap}
              style={{
                background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
                color: '#94a3b8', borderRadius: '12px', padding: '10px 16px',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              ← Leave Terminal
            </button>
          )}
        </div>

        <div style={{ padding: '32px 36px' }}>
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
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ＋ Launch New Virtual Session
            </button>
          ) : (
            <div style={{
              background: 'rgba(15, 23, 42, 0.35)', border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '20px', padding: '28px', marginBottom: '32px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifySpace: 'between', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px' }}>Session Parameters</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
                >✕</button>
              </div>

              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '14px' }}>
                  <input
                    type="text"
                    placeholder="Session label (e.g. MCQ Sprint Room 3)"
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
                    <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{ ...formInputStyle, marginTop: '6px' }}
                      onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ background: '#0f172a', color: '#e2e8f0' }}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      style={{ ...formInputStyle, marginTop: '6px' }}
                      onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                    >
                      <option value="EASY" style={{ background: '#0f172a', color: '#e2e8f0' }}>🟢 Easy</option>
                      <option value="MEDIUM" style={{ background: '#0f172a', color: '#e2e8f0' }}>🟡 Medium</option>
                      <option value="HARD" style={{ background: '#0f172a', color: '#e2e8f0' }}>🔴 Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Questions (1–8)</label>
                    <input
                      type="number" min="1" max="8" value={questionCount}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      style={{ ...formInputStyle, marginTop: '6px' }}
                      onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Max Participants</label>
                    <input
                      type="number" min="1" max="20" value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      style={{ ...formInputStyle, marginTop: '6px' }}
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
                  onMouseEnter={(e) => { if (!creating) e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={(e) => { if (!creating) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {creating ? 'Creating session node...' : 'Launch Session Node'}
                </button>
              </form>
            </div>
          )}

          {/* Open Challenges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Active Terminal Sessions
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
              onMouseEnter={(e) => e.currentTarget.style.color = '#94a3b8'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
            >
              ↻ Refresh Node
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#64748b', fontSize: '14px', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
              Loading active nodes...
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
                No terminal sessions are currently open. Click above to launch the first one!
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
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>{c.name}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                        background: diff.bg, color: diff.text, border: `1px solid ${diff.border}`, fontWeight: 700,
                      }}>
                        {c.difficulty}
                      </span>
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
                    onMouseEnter={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { if (!isFull && joiningId !== c.id) e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {joiningId === c.id ? '...' : isFull ? 'Full' : 'Join Match'}
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

export default Lab;