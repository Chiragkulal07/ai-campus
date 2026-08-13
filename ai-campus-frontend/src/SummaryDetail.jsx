import { useEffect, useState } from 'react';
import { API_URL, SOCKET_URL } from './config';

function SummaryDetail({ token, type, buildingId, label, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = type === 'game'
      ? `${API_URL}/profile/me/summary/games`
      : `${API_URL}/profile/me/summary/challenges/${buildingId}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not load details'); setLoading(false); });
  }, [token, type, buildingId]);

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Inter', sans-serif" }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: '24px', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
          padding: '8px 16px', borderRadius: '10px', fontSize: '13px'
        }}
      >
        ← Back to Summary
      </button>

      <h2 style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>
        {label} — Match History
      </h2>

      {loading && <p style={{ color: '#64748b' }}>Loading...</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: '#64748b' }}>No completed matches here yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {type === 'game'
          ? items.map((m, i) => (
            <div key={i} style={{
              background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>{m.matchName}</span>
                <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: '15px' }}>
                  {m.kills} kill{m.kills === 1 ? '' : 's'} · rank #{m.finalRank}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                {new Date(m.playedAt).toLocaleString()}
              </div>
              {m.opponents.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {m.opponents.map((o, oi) => (
                    <span key={oi} style={{
                      fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '4px 10px'
                    }}>
                      {o.displayName}: {o.kills} kills
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
          : items.map((c) => (
            <div key={c.challengeId} style={{
              background: 'rgba(15,23,42,0.45)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px', padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>{c.name}</span>
                <span style={{ color: '#6366f1', fontWeight: 800, fontSize: '15px' }}>
                  {c.yourCorrect}/{c.questionCount} correct
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                {c.category.replace(/_/g, ' ')} · {c.difficulty} · {new Date(c.completedAt).toLocaleString()}
              </div>
              {c.opponents.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {c.opponents.map((o, oi) => (
                    <span key={oi} style={{
                      fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '4px 10px'
                    }}>
                      {o.displayName}: {o.score / 10} correct
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

export default SummaryDetail;