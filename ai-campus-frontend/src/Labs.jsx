const LAB_META = {
  CODING_LAB:     { icon: '💻', accent: '#6366f1', description: 'Create and join live coding challenges, MCQ sprints, and DSA battles.' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#f59e0b', description: 'Conduct mock interviews and technical Q&As with voice-chat support.' },
  LIBRARY:        { icon: '📚', accent: '#10b981', description: 'Access document-based quizzes and study resources with friends.' },
  EVENT_HALL:     { icon: '🎉', accent: '#ec4899', description: 'Join and create online hackathons, events, and developer gatherings.' },
};

function Labs({ onSelectLab, labs }) {
  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px', letterSpacing: '-0.5px' }}>
          🏛️ Campus Sectors
        </h2>
        <p style={{ color: '#64748b', fontSize: '14.5px', fontWeight: 500 }}>
          Select a building sector below to connect to its terminals and participate in live challenges.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {labs.map((lab) => {
          const meta = LAB_META[lab.id] || { icon: '🏛️', accent: '#6366f1', description: lab.description };
          return (
            <div
              key={lab.id}
              onClick={() => onSelectLab(lab.id, lab.name)}
              style={{
                background: 'rgba(15,23,42,0.45)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '20px',
                padding: '28px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = meta.accent;
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 12px 30px ${meta.accent}12`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: meta.accent, borderRadius: '20px 20px 0 0',
              }} />

              <div>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: meta.accent + '15',
                  border: `1.5px solid ${meta.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                  marginBottom: '16px',
                  boxShadow: `0 0 15px ${meta.accent}12`
                }}>{meta.icon}</div>

                <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '17px', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                  {lab.name}
                </div>
                <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
                  {meta.description}
                </p>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                color: meta.accent, fontSize: '13px', fontWeight: 700,
              }}>
                Connect to Terminal →
              </div>
            </div>
          );
        })}

        {/* Manually render Gaming Lab */}
        <div
          onClick={() => onSelectLab('gaminglab', 'Gaming Lab')}
          style={{
            background: 'rgba(15,23,42,0.45)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            padding: '28px 24px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.12)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: '#3b82f6', borderRadius: '20px 20px 0 0',
          }} />

          <div>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1.5px solid rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
              marginBottom: '16px',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.08)'
            }}>🎮</div>

            <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '17px', marginBottom: '8px', letterSpacing: '-0.3px' }}>
              Gaming Lab
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
              Enter the battle arena, create custom game lobbies, and challenge other players to real-time laser combat matches.
            </p>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            color: '#3b82f6', fontSize: '13px', fontWeight: 700,
          }}>
            Connect to Terminal →
          </div>
        </div>
      </div>
    </div>
  );
}

export default Labs;