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
      .catch(() => { setError('Could not load match records'); setLoading(false); });
  }, [token]);

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: '28px', cursor: 'pointer',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255,255,255,0.09)', color: '#cbd5e1',
          padding: '8px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#c084fc'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateX(-3px)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.transform = 'translateX(0)'; }}
      >
        ← Back to Summary
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #c084fc, #38bdf8)', borderRadius: '2px' }} />
        <h2 style={{ color: '#ffffff', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>
          {label || 'Gaming Lab'} — Detailed Match Records
        </h2>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', fontSize: '14px', padding: '30px 0' }}>
          <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.1)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading tournament telemetry…
        </div>
      )}

      {error && <p style={{ color: '#f87171', fontSize: '14px' }}>⚠️ {error}</p>}

      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'rgba(11, 17, 33, 0.65)', border: '1.5px dashed rgba(168, 85, 247, 0.25)',
          borderRadius: '24px', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ fontSize: '42px', marginBottom: '14px', filter: 'drop-shadow(0 0 16px rgba(192, 132, 252, 0.4))' }}>🕹️</div>
          <h4 style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No Combat History Yet</h4>
          <p style={{ color: '#94a3b8', fontSize: '13.5px' }}>Enter the Gaming Lab arena to fight in your first laser combat match!</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {items.map((m, i) => (
          <div key={i} style={{
            background: 'linear-gradient(135deg, rgba(20, 26, 48, 0.65) 0%, rgba(10, 15, 30, 0.75) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '22px',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.2s ease',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.4)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          >
            {/* Top Accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #c084fc, transparent)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.2px' }}>{m.matchName}</span>
              <span style={{
                color: '#38bdf8', fontWeight: 800, fontSize: '13px',
                background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '4px 12px', borderRadius: '10px'
              }}>
                {m.kills} kill{m.kills === 1 ? '' : 's'} · Rank #{m.finalRank}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
              {new Date(m.playedAt).toLocaleString()}
            </div>
            {m.opponents && m.opponents.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {m.opponents.map((o, oi) => (
                  <span key={oi} style={{
                    fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 12px',
                    fontWeight: 600
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