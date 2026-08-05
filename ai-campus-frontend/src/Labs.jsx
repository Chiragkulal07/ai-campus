const LAB_META = {
  CODING_LAB:     { icon: '💻', accent: '#188c88' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#5c4535' },
  LIBRARY:        { icon: '📚', accent: '#b08154' },
  EVENT_HALL:     { icon: '🎉', accent: '#de9b2a' },
};

function Labs({ onSelectLab, labs }) {
  return (
    <div style={{
      maxWidth: '800px', margin: '0 auto', padding: '40px 24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', marginBottom: '6px' }}>
          🏛️ Campus Buildings
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Enter a building to create or join challenges inside it.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {labs.map((lab) => {
          const meta = LAB_META[lab.id] || { icon: '🏛️', accent: '#6366f1' };
          return (
            <div
              key={lab.id}
              onClick={() => onSelectLab(lab.id, lab.name)}
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px', padding: '24px',
                cursor: 'pointer', transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = meta.accent + '66';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Accent stripe */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: meta.accent, borderRadius: '18px 18px 0 0',
              }} />

              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{meta.icon}</div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '16px', marginBottom: '6px' }}>
                {lab.name}
              </div>
              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
                {lab.description}
              </p>
              <div style={{
                marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                color: meta.accent, fontSize: '12px', fontWeight: 600,
              }}>
                Enter building →
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Labs;