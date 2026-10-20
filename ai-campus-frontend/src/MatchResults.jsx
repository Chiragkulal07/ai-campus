function MatchResults({ leaderboard, myUserId, onExit }) {
  const medal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div style={{
      padding: '48px 24px',
      maxWidth: '540px',
      margin: '0 auto',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      textAlign: 'center'
    }}>
      {/* Trophy & Title */}
      <div style={{
        fontSize: '48px',
        marginBottom: '10px',
        filter: 'drop-shadow(0 0 20px rgba(253, 224, 71, 0.5))'
      }}>🏆</div>

      <h2 style={{
        color: '#ffffff',
        fontSize: '28px',
        fontWeight: 900,
        letterSpacing: '-0.5px',
        marginBottom: '4px'
      }}>
        Combat Match Complete
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '13.5px', marginBottom: '28px' }}>
        Timer zero reached — final battlefield frag standings
      </p>

      {/* Leaderboard list */}
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {leaderboard.map((p, index) => {
          const rank = index + 1;
          const isMe = p.userId === myUserId;

          return (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: '14px',
                background: isMe
                  ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)'
                  : 'rgba(15, 23, 42, 0.6)',
                border: isMe
                  ? '1.5px solid rgba(192, 132, 252, 0.6)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isMe
                  ? '0 8px 24px rgba(147, 51, 234, 0.35), 0 0 16px rgba(56, 189, 248, 0.2)'
                  : '0 4px 12px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', width: '28px', textAlign: 'center', color: '#94a3b8', fontWeight: 800 }}>
                  {medal(rank) || `#${rank}`}
                </span>
                <span style={{ fontWeight: isMe ? 800 : 600, color: '#f8fafc', fontSize: '15px' }}>
                  {p.displayName}
                  {isMe && (
                    <span style={{
                      marginLeft: '8px', fontSize: '10px', fontWeight: 800,
                      color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 7px',
                      borderRadius: '6px', textTransform: 'uppercase'
                    }}>YOU</span>
                  )}
                </span>
              </div>
              <span style={{
                color: isMe ? '#38bdf8' : '#c084fc',
                fontWeight: 800,
                fontSize: '14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '4px 12px',
                borderRadius: '8px'
              }}>
                {p.kills} kill{p.kills === 1 ? '' : 's'}
              </span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onExit}
        style={{
          marginTop: '32px',
          padding: '12px 28px',
          borderRadius: '12px',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
          border: 'none',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '14px',
          boxShadow: '0 6px 20px rgba(124, 58, 237, 0.45)',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        ← Back to Gaming Lab Hub
      </button>
    </div>
  );
}

export default MatchResults;