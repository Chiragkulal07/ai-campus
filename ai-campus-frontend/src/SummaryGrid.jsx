import { useEffect, useState } from 'react';
import { API_URL } from './config';

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
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.07)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'sg-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#475569', fontSize: '13px' }}>Loading your combat record…</p>
        <style>{`@keyframes sg-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', color: '#f87171', textAlign: 'center', fontSize: '14px' }}>
        ⚠️ {error}
      </div>
    );
  }

  const matches = summary?.gamingLab?.totalMatches || 0;
  const kills = summary?.gamingLab?.totalKills || 0;
  const avgKills = matches > 0 ? (kills / matches).toFixed(1) : '0.0';

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Outfit', sans-serif" }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          marginBottom: '28px', cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8',
          padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'all 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = '#f1f5f9'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
      >
        ← Back to Reception
      </button>

      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '3px', height: '22px', background: 'linear-gradient(180deg, #3b82f6, #60a5fa)', borderRadius: '2px' }} />
          <h2 style={{
            color: '#f8fafc', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.8px',
          }}>
            Combat Career & Battlefield Summary
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '13.5px', paddingLeft: '13px' }}>
          Overview of all live laser-combat engagements and tournament standings in the Gaming Lab.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Gaming Lab Featured Card */}
        <div
          onClick={() => onOpenDetail('game', null, 'Gaming Lab')}
          style={{
            background: 'linear-gradient(135deg, rgba(20,30,50,0.7), rgba(13,20,36,0.6))',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '24px',
            padding: '28px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            backdropFilter: 'blur(16px)',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.08)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 45px rgba(59,130,246,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.08)';
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '24px 24px 0 0' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
              boxShadow: '0 0 20px rgba(59,130,246,0.15)'
            }}>🕹️</div>

            <span style={{
              fontSize: '11px', fontWeight: 700, color: '#3b82f6',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
              padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              Active Arena
            </span>
          </div>

          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              Gaming Lab Battlefield
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Real-time authoritative combat simulation arena.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px' }}>{matches}</div>
              <div style={{ color: '#475569', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Matches</div>
            </div>
            <div>
              <div style={{ color: '#60a5fa', fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px' }}>{kills}</div>
              <div style={{ color: '#475569', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Kills</div>
            </div>
            <div>
              <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px' }}>{avgKills}</div>
              <div style={{ color: '#475569', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kills / Match</div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#3b82f6', fontSize: '13px', fontWeight: 700, paddingTop: '4px'
          }}>
            <span>View Full Match History</span>
            <span style={{ fontSize: '16px' }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryGrid;
