import { useEffect, useState } from 'react';
import { API_URL } from './config';

function SummaryDetail({ token, label, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/profile/me/summary/games`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Could not load details'); setLoading(false); });
  }, [token]);

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Outfit', sans-serif" }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: '24px', cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8',
          padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'all 0.18s'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
      >
        ← Back to Summary
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ width: '3px', height: '22px', background: 'linear-gradient(180deg, #3b82f6, #60a5fa)', borderRadius: '2px' }} />
        <h2 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.6px', margin: 0 }}>
          {label || 'Gaming Lab'} — Match History
        </h2>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', padding: '20px 0' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'sd-spin 0.8s linear infinite' }} />
          Loading match records…
          <style>{`@keyframes sd-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && <p style={{ color: '#f87171', fontSize: '14px' }}>⚠️ {error}</p>}

      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'rgba(15,23,42,0.4)', border: '1.5px dashed rgba(255,255,255,0.06)',
          borderRadius: '20px'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🕹️</div>
          <h4 style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No Combat History Yet</h4>
          <p style={{ color: '#475569', fontSize: '13px' }}>Jump into the Gaming Lab arena to fight in your first match!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((m, i) => (
          <div key={i} style={{
            background: 'linear-gradient(135deg, rgba(20,30,50,0.6), rgba(13,20,36,0.5))',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '20px',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.18s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '15px' }}>{m.matchName}</span>
              <span style={{
                color: '#3b82f6', fontWeight: 800, fontSize: '14px',
                background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                padding: '4px 10px', borderRadius: '8px'
              }}>
                {m.kills} kill{m.kills === 1 ? '' : 's'} · Rank #{m.finalRank}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {new Date(m.playedAt).toLocaleString()}
            </div>
            {m.opponents && m.opponents.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
        ))}
      </div>
    </div>
  );
}

export default SummaryDetail;