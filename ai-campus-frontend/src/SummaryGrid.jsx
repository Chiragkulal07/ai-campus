import { useEffect, useState } from 'react';
import { API_URL, SOCKET_URL } from './config';

const BUILDING_META = {
  CODING_LAB: { icon: '💻', accent: '#6366f1', label: 'Coding Lab' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#f59e0b', label: 'Interview Hall' },
  LIBRARY: { icon: '📚', accent: '#10b981', label: 'Library' },
  EVENT_HALL: { icon: '🎉', accent: '#ec4899', label: 'Event Hall' },
};

function SummaryGrid({ token, onOpenDetail, onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/profile/me/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => { setSummary(data); setLoading(false); })
      .catch(() => { setError('Could not load summary'); setLoading(false); });
  }, [token]);

  if (loading) {
    return <div style={{ padding: '40px', color: '#64748b', textAlign: 'center' }}>Loading your summary...</div>;
  }

  if (error) {
    return <div style={{ padding: '40px', color: '#f87171', textAlign: 'center' }}>{error}</div>;
  }

  const cardStyle = (accent) => ({
    background: 'rgba(15,23,42,0.45)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '20px',
    padding: '24px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    transition: 'all 0.2s',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Inter', sans-serif" }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: '24px', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
          padding: '8px 16px', borderRadius: '10px', fontSize: '13px'
        }}
      >
        ← Back to Reception
      </button>

      <h2 style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
        Your Campus Summary
      </h2>
      <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '32px' }}>
        Click any card to see the individual matches and who you played against.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {summary.labs.map((lab) => {
          const meta = BUILDING_META[lab.buildingId] || { icon: '🏛️', accent: '#6366f1', label: lab.buildingId };
          return (
            <div
              key={lab.buildingId}
              onClick={() => onOpenDetail('challenge', lab.buildingId, meta.label)}
              style={cardStyle(meta.accent)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: meta.accent + '15', border: `1.5px solid ${meta.accent}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
              }}>{meta.icon}</div>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px' }}>{meta.label}</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div>
                  <div style={{ color: meta.accent, fontWeight: 800, fontSize: '20px' }}>{lab.totalMatches}</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Quizzes</div>
                </div>
                <div>
                  <div style={{ color: meta.accent, fontWeight: 800, fontSize: '20px' }}>{lab.totalCorrect}</div>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Correct</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Gaming Lab card — separate shape (kills, not correct answers) */}
        <div
          onClick={() => onOpenDetail('game', null, 'Gaming Lab')}
          style={cardStyle('#3b82f6')}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.33)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
          }}>🔫</div>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px' }}>Gaming Lab</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div>
              <div style={{ color: '#3b82f6', fontWeight: 800, fontSize: '20px' }}>{summary.gamingLab.totalMatches}</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>Matches</div>
            </div>
            <div>
              <div style={{ color: '#3b82f6', fontWeight: 800, fontSize: '20px' }}>{summary.gamingLab.totalKills}</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>Kills</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryGrid;