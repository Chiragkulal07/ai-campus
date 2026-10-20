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
      <div style={{ padding: '80px', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>
        <div style={{
          width: '36px', height: '36px',
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#c084fc',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Accessing telemetry & combat records…</p>
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
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '40px 24px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          marginBottom: '28px', cursor: 'pointer',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255,255,255,0.09)', color: '#cbd5e1',
          padding: '8px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#38bdf8'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateX(-3px)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.transform = 'translateX(0)'; }}
      >
        ← Back to Reception
      </button>

      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #c084fc, #38bdf8)', borderRadius: '2px' }} />
          <h2 style={{
            color: '#ffffff', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.6px', margin: 0
          }}>
            Combat Career & Battlefield Summary
          </h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', paddingLeft: '16px', margin: 0 }}>
          Authoritative combat history, laser frag counts, and tournament statistics in the Gaming Lab.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Gaming Lab Featured Card */}
        <div
          onClick={() => onOpenDetail('game', null, 'Gaming Lab')}
          style={{
            background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.25) 0%, rgba(15, 23, 42, 0.85) 100%)',
            border: '1.5px solid rgba(192, 132, 252, 0.4)',
            borderRadius: '24px',
            padding: '30px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            backdropFilter: 'blur(20px)',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 25px rgba(168, 85, 247, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#c084fc';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6), 0 0 35px rgba(192, 132, 252, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5), 0 0 25px rgba(168, 85, 247, 0.15)';
          }}
        >
          {/* Top glowing accent bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #c084fc, #38bdf8)', borderRadius: '24px 24px 0 0' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(147, 51, 234, 0.2)', border: '1.5px solid rgba(192, 132, 252, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)'
            }}>🕹️</div>

            <span style={{
              fontSize: '11px', fontWeight: 800, color: '#c084fc',
              background: 'rgba(147, 51, 234, 0.18)', border: '1px solid rgba(192, 132, 252, 0.4)',
              padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.8px'
            }}>
              Active Sector
            </span>
          </div>

          <div>
            <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              Gaming Lab Arena Record
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0, lineHeight: '1.5' }}>
              Real-time authoritative laser combat tournament telemetry and opponent records.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ color: '#c084fc', fontWeight: 900, fontSize: '26px', letterSpacing: '-0.5px' }}>{matches}</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '2px' }}>Matches</div>
            </div>
            <div>
              <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '26px', letterSpacing: '-0.5px' }}>{kills}</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '2px' }}>Total Kills</div>
            </div>
            <div>
              <div style={{ color: '#34d399', fontWeight: 900, fontSize: '26px', letterSpacing: '-0.5px' }}>{avgKills}</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '2px' }}>Kills / Match</div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#38bdf8', fontSize: '13.5px', fontWeight: 800, paddingTop: '4px'
          }}>
            <span>View Full Match Records</span>
            <span style={{ fontSize: '18px' }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryGrid;
