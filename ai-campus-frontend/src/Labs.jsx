const LAB_META = {
  CODING_LAB:     { icon: '💻', accent: '#6366f1', description: 'Create and join live coding challenges, MCQ sprints, and DSA battles.' },
  INTERVIEW_HALL: { icon: '🎤', accent: '#f59e0b', description: 'Conduct mock interviews and technical Q&As with voice-chat support.' },
  LIBRARY:        { icon: '📚', accent: '#10b981', description: 'Access document-based quizzes and study resources with friends.' },
  EVENT_HALL:     { icon: '🎉', accent: '#ec4899', description: 'Join and create online hackathons, events, and developer gatherings.' },
};

function Labs({ onSelectLab, labs }) {
  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '50px 24px',
      fontFamily: "'Outfit', 'Inter', sans-serif",
    }}>
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px',
          letterSpacing: '-1px'
        }}>
          🔬 Campus Training Terminals
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 500, maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
          Connect to active simulator buildings to upgrade your technical capabilities and challenge other players.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '28px',
        justifyContent: 'center',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Render Interview Hall */}
        {labs.map((lab) => {
          const meta = LAB_META[lab.id] || { icon: '🏛️', accent: '#f59e0b', description: lab.description };
          return (
            <div
              key={lab.id}
              onClick={() => onSelectLab(lab.id, lab.name)}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.45) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '24px',
                padding: '32px 28px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backdropFilter: 'blur(12px)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = meta.accent;
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = `0 20px 40px ${meta.accent}1c, 0 0 15px ${meta.accent}22`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.25)';
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: `linear-gradient(90deg, ${meta.accent}, #fbbf24)`, borderRadius: '24px 24px 0 0',
              }} />

              <div>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: `1.5px solid ${meta.accent}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
                  marginBottom: '24px',
                  boxShadow: `0 0 20px ${meta.accent}18`
                }}>{meta.icon}</div>

                <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '20px', marginBottom: '12px', letterSpacing: '-0.4px' }}>
                  {lab.name}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                  {meta.description}
                </p>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                color: meta.accent, fontSize: '14px', fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                Initialize Mock Link <span style={{ transition: 'transform 0.2s' }}>→</span>
              </div>
            </div>
          );
        })}

        {/* Manually render Gaming Lab */}
        <div
          onClick={() => onSelectLab('gaminglab', 'Gaming Lab')}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.45) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: '24px',
            padding: '32px 28px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(12px)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.transform = 'translateY(-6px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(59, 130, 246, 0.12), 0 0 15px rgba(59, 130, 246, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.25)';
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '24px 24px 0 0',
          }} />

          <div>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1.5px solid rgba(59, 130, 246, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
              marginBottom: '24px',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.12)'
            }}>🎮</div>

            <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '20px', marginBottom: '12px', letterSpacing: '-0.4px' }}>
              Gaming Lab
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              Enter the laser-combat simulation arena, spin up live lobbies, and challenge online peers in real-time matches.
            </p>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: '#3b82f6', fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.5px'
          }}>
            Initialize Combat Link <span style={{ transition: 'transform 0.2s' }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Labs;