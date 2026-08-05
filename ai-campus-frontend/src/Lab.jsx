import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const LAB_ICONS = {
  CODING_LAB: '💻',
  INTERVIEW_HALL: '🎤',
  LIBRARY: '📚',
  EVENT_HALL: '🎉',
};

const DIFFICULTY_COLORS = {
  EASY: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  MEDIUM: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  HARD: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
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
    fetch(`http://localhost:4000/challenges?building=${buildingId}`)
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
    const socket = io('http://localhost:4001');
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
      const res = await fetch('http://localhost:4000/challenges', {
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
    const res = await fetch(`http://localhost:4000/challenges/${challengeId}/join`, {
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(145deg, #0f172a, #1e293b)',
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              fontSize: '36px', width: '60px', height: '60px',
              background: 'rgba(255,255,255,0.07)', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {labIcon}
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '22px', fontWeight: 700 }}>
                {buildingName}
              </h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                Create or join a live challenge below
              </p>
            </div>
          </div>
          {onBackToMap && (
            <button
              onClick={onBackToMap}
              style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', borderRadius: '10px', padding: '8px 14px',
                cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              ← Back to Map
            </button>
          )}
        </div>

        <div style={{ padding: '24px 32px' }}>
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5', borderRadius: '10px', padding: '10px 14px',
              fontSize: '13px', marginBottom: '20px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Create Challenge Button / Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', border: 'none', borderRadius: '14px',
                fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                marginBottom: '28px', letterSpacing: '0.3px',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              ＋ Create a New Challenge
            </button>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '18px', padding: '24px', marginBottom: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '16px', fontWeight: 600 }}>New Challenge</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}
                >✕</button>
              </div>

              <form onSubmit={handleCreate}>
                <input
                  type="text"
                  placeholder="Challenge name (e.g. Morning DSA Sprint)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 14px', marginBottom: '12px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', color: '#f1f5f9', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', marginTop: '4px',
                        background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#e2e8f0', fontSize: '13px', outline: 'none',
                      }}
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', marginTop: '4px',
                        background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#e2e8f0', fontSize: '13px', outline: 'none',
                      }}
                    >
                      <option value="EASY">🟢 Easy</option>
                      <option value="MEDIUM">🟡 Medium</option>
                      <option value="HARD">🔴 Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Questions (1–8)</label>
                    <input
                      type="number" min="1" max="8" value={questionCount}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', marginTop: '4px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Players</label>
                    <input
                      type="number" min="1" max="20" value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', marginTop: '4px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', color: '#f1f5f9', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    width: '100%', padding: '13px',
                    background: creating ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                    boxShadow: creating ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
                  }}
                >
                  {creating ? '⏳ Creating...' : '🚀 Launch Challenge'}
                </button>
              </form>
            </div>
          )}

          {/* Open Challenges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '15px', fontWeight: 600 }}>
              Open Challenges
              {challenges.length > 0 && (
                <span style={{
                  marginLeft: '8px', background: 'rgba(99,102,241,0.25)',
                  color: '#a5b4fc', fontSize: '12px', padding: '2px 8px',
                  borderRadius: '20px', fontWeight: 500,
                }}>{challenges.length}</span>
              )}
            </h3>
            <button
              onClick={loadChallenges}
              style={{
                background: 'none', border: 'none', color: '#64748b',
                cursor: 'pointer', fontSize: '13px', padding: '4px 8px',
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              Loading challenges...
            </div>
          )}

          {!loading && challenges.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '50px 20px',
              background: 'rgba(255,255,255,0.02)', borderRadius: '16px',
              border: '1px dashed rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
              <p style={{ color: '#475569', margin: 0, fontSize: '14px' }}>
                No open challenges yet — be the first to create one!
              </p>
            </div>
          )}

          {challenges.map((c) => {
            const diff = DIFFICULTY_COLORS[c.difficulty] || DIFFICULTY_COLORS.EASY;
            const spotsLeft = c.maxParticipants - (c.currentParticipants ?? 0);
            const isFull = spotsLeft <= 0;
            return (
              <div
                key={c.id}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px', padding: '16px 20px', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px' }}>{c.name}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 7px', borderRadius: '6px',
                      background: diff.bg, color: diff.text, fontWeight: 600,
                    }}>
                      {c.difficulty}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>🏷️ {c.category.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>❓ {c.questionCount} questions</span>
                    <span style={{ fontSize: '12px', color: isFull ? '#f87171' : '#64748b' }}>
                      👥 {c.currentParticipants ?? 0}/{c.maxParticipants} {isFull ? '(Full)' : `(${spotsLeft} spots left)`}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>by {c.creatorName}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(c.id)}
                  disabled={isFull || joiningId === c.id}
                  style={{
                    padding: '10px 20px', borderRadius: '12px', border: 'none',
                    background: isFull ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: isFull ? '#475569' : 'white', fontWeight: 600, fontSize: '13px',
                    cursor: isFull ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    boxShadow: isFull ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
                  }}
                >
                  {joiningId === c.id ? 'Joining...' : isFull ? 'Full' : '▶ Join'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Lab;