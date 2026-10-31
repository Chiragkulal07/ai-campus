import { useEffect, useState } from 'react';
import { API_URL } from './config';
import { readJson } from './utils';
import { IconAlert, IconGamepad } from './icons';
import BackButton from './BackButton';
import { SplitWords } from './fx';

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function SummaryDetail({ token, label, onBack, backLabel = 'Back to Stats' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/profile/me/summary/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await readJson(res);
        if (!res.ok) throw new Error();
        return data;
      })
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setError('Could not load match history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="page page-narrow">
      <BackButton onClick={onBack} label={backLabel} className="page-back" />

      <div className="page-header">
        <div>
          <h1 className="page-title"><SplitWords text="Match history" /></h1>
          <p className="page-subtitle">{label || 'Gaming Lab'}{!loading && !error ? ` · ${items.length} ${items.length === 1 ? 'match' : 'matches'}` : ''}</p>
        </div>
      </div>

      {loading && <div className="loading-row"><span className="spinner" /> Loading matches…</div>}

      {error && <div className="alert"><IconAlert size={15} /><span>{error}</span></div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <span className="icon-tile"><IconGamepad size={18} /></span>
          <div className="empty-state-title">No matches yet</div>
          <p className="empty-state-desc">Your results will appear here after you finish a match in the Gaming Lab.</p>
        </div>
      )}

      <div className={`stack ${items.length ? 'timeline' : ''}`}>
        {items.map((m, i) => (
          <div key={m.matchId || i} className={`card ${m.finalRank === 1 ? 'is-win' : ''}`} style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="list-row-title truncate">{m.matchName || 'Untitled match'}</div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{formatDate(m.playedAt)}</div>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                {m.finalRank != null && (
                  <span className={`badge ${m.finalRank === 1 ? 'badge-gold' : ''}`}>{m.finalRank === 1 ? 'Winner' : `Rank #${m.finalRank}`}</span>
                )}
                <span className="badge badge-accent">{m.kills ?? 0} {m.kills === 1 ? 'kill' : 'kills'}</span>
              </div>
            </div>

            {m.opponents?.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="hint" style={{ marginBottom: 6 }}>Opponents</div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {m.opponents.map((o, oi) => (
                    <span key={oi} className="badge">{o.displayName} · {o.kills ?? 0}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SummaryDetail;
