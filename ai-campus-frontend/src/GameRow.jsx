import { formatDuration } from './utils';
import { IconClock, IconUsers, IconGamepad } from './icons';

function GameRow({ game, joining, onJoin }) {
  const joined = game.currentParticipants ?? 0;
  const isFull = joined >= game.maxPlayers;

  return (
    <div className="list-row">
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <span className="icon-tile is-violet"><IconGamepad size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="list-row-title truncate">{game.name}</span>
            {isFull
              ? <span className="badge badge-red">Full</span>
              : <span className="badge badge-green">Open</span>}
          </div>
          <div className="list-row-meta">
            <span>
              <IconUsers size={13} /> {joined}/{game.maxPlayers}
              {game.maxPlayers <= 12 && (
                <span className={`capacity ${isFull ? 'is-full' : ''}`} aria-hidden="true">
                  {Array.from({ length: game.maxPlayers }, (_, i) => (
                    <i key={i} className={i < joined ? 'is-filled' : ''} style={{ '--i': i }} />
                  ))}
                </span>
              )}
            </span>
            <span><IconClock size={13} /> {formatDuration(game.durationSec)}</span>
            {game.creatorName && <span>Hosted by {game.creatorName}</span>}
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
        onClick={() => onJoin(game.id)}
        disabled={isFull || joining}
        style={{ minWidth: 84 }}
      >
        {joining ? 'Joining…' : isFull ? 'Full' : 'Join'}
      </button>
    </div>
  );
}

export default GameRow;
