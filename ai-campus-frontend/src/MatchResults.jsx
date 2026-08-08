function MatchResults({ leaderboard, myUserId, onExit }) {
  const medal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '500px', margin: '0 auto', color: '#e2e8f0', textAlign: 'center' }}>
      <h2 style={{ color: '#f1f5f9', marginBottom: '4px' }}>Match Complete</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>Time's up — here's how everyone did.</p>

      <div style={{ textAlign: 'left' }}>
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
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '10px',
                background: isMe ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                border: isMe ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px', width: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  {medal(rank) || `#${rank}`}
                </span>
                <span style={{ fontWeight: isMe ? 700 : 500, color: '#f1f5f9' }}>
                  {p.displayName}{isMe ? ' (you)' : ''}
                </span>
              </div>
              <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{p.kills} kills</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={onExit}
        style={{
          marginTop: '24px', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer',
          background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)',
          color: '#a5b4fc', fontWeight: 600
        }}
      >
        Back to Gaming Lab
      </button>
    </div>
  );
}

export default MatchResults;