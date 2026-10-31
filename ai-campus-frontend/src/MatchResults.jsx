import { IconArrowLeft, IconTrophy } from './icons';
import { SplitWords } from './fx';

// Deterministic confetti burst (no randomness so re-renders stay stable).
const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const dist = 110 + (i % 5) * 28;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist * 0.7 + 90)}px`,
    r: `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
    c: ['#f59e0b', '#fcd34d', '#34d399', '#5eead4', '#fb923c', '#f5f5f4'][i % 6],
  };
});

const RANK_COLORS = { 1: '#fbbf24', 2: '#d6d3d1', 3: '#d97706' };

function MatchResults({ leaderboard = [], myUserId, onExit }) {
  const myIndex = leaderboard.findIndex((p) => p.userId === myUserId);

  return (
    <div className="page page-narrow" style={{ maxWidth: 520, paddingTop: 56, position: 'relative' }}>
      <div style={{ textAlign: 'center', marginBottom: 28, position: 'relative' }}>
        {myIndex >= 0 && myIndex < 3 && (
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((p, i) => (
              <i key={i} style={{ '--i': i, '--x': p.x, '--y': p.y, '--r': p.r, background: p.c }} />
            ))}
          </div>
        )}
        <span className="icon-tile trophy" style={{ width: 48, height: 48, margin: '0 auto 14px', color: 'var(--yellow-text)', background: 'var(--yellow-soft)', borderColor: 'transparent' }}>
          <IconTrophy size={22} />
        </span>
        <h1 className="page-title"><SplitWords text={myIndex === 0 ? 'You won the match' : 'Match over'} delay={250} /></h1>
        <p className="page-subtitle">
          {myIndex >= 0 ? `You finished #${myIndex + 1} of ${leaderboard.length}.` : 'Final standings'}
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {leaderboard.length === 0 && (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No results recorded.</div>
        )}
        {leaderboard.map((p, index) => {
          const rank = index + 1;
          const isMe = p.userId === myUserId;
          return (
            <div
              key={p.userId}
              className={`row result-row ${isMe ? 'is-me' : ''}`}
              style={{
                justifyContent: 'space-between',
                padding: '12px 16px',
                '--i': index,
                borderTop: index ? '1px solid var(--border)' : 'none',
                background: isMe ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div className="row" style={{ gap: 12, minWidth: 0 }}>
                <span className="mono" style={{ width: 24, textAlign: 'center', fontWeight: 600, color: RANK_COLORS[rank] || 'var(--text-dim)' }}>
                  {rank}
                </span>
                <span className="truncate" style={{ fontWeight: isMe ? 600 : 500, color: 'var(--text-strong)' }}>
                  {p.displayName}
                </span>
                {isMe && <span className="badge badge-accent">You</span>}
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', fontSize: 13.5 }}>
                <strong style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{p.kills}</strong> {p.kills === 1 ? 'kill' : 'kills'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          <IconArrowLeft size={15} /> Back to Gaming Lab
        </button>
      </div>
    </div>
  );
}

export default MatchResults;
