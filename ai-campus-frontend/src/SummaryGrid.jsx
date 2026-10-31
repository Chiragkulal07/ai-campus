import { useEffect, useState } from 'react';
import { API_URL } from './config';
import { readJson } from './utils';
import { IconAlert, IconArrowRight, IconGamepad } from './icons';
import BackButton from './BackButton';
import { CountUp, SplitWords } from './fx';

function SummaryGrid({ token, onOpenDetail, onBack, backLabel }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/profile/me/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || 'Could not load stats');
        return data;
      })
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setError('Could not load your stats. Try again in a moment.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const g = summary?.gamingLab || {};
  const progress = summary?.progress;
  const levelPct = progress ? Math.round((progress.xpIntoLevel / progress.xpPerLevel) * 100) : 0;
  const stats = [
    { label: 'Matches played', value: g.totalMatches ?? 0 },
    { label: 'Wins', value: g.wins ?? 0 },
    { label: 'Win rate', value: g.winRate ?? 0, suffix: '%' },
    { label: 'Total kills', value: g.totalKills ?? 0 },
    { label: 'Kills per match', value: g.avgKills ?? 0, decimals: 1 },
    { label: 'Best match', value: g.bestKills ?? 0, suffix: ' kills' },
  ];

  return (
    <div className="page">
      {onBack && <BackButton onClick={onBack} label={backLabel} className="page-back" />}
      <div className="page-header">
        <div>
          <h1 className="page-title"><SplitWords text="Your stats" /></h1>
          <p className="page-subtitle">Your performance across all labs.</p>
        </div>
      </div>

      {loading && <div className="loading-row"><span className="spinner" /> Loading stats…</div>}

      {error && <div className="alert"><IconAlert size={15} /><span>{error}</span></div>}

      {!loading && !error && progress && (
        <section className="card level-card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div>
              <div className="stat-label">Level</div>
              <div className="stat-value"><CountUp value={progress.level} /></div>
            </div>
            <div className="muted" style={{ fontSize: 13, textAlign: 'right' }}>
              <strong style={{ color: 'var(--text-strong)' }}><CountUp value={progress.xp} /></strong> XP total
              <div className="dim" style={{ fontSize: 12 }}>
                {progress.xpPerLevel - progress.xpIntoLevel} XP to level {progress.level + 1}
              </div>
            </div>
          </div>
          <div className="level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelPct} aria-label="Progress to next level">
            <div className="level-bar-fill" style={{ width: `${levelPct}%` }} />
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            XP comes from your matches: 50 per match, 10 per kill, and a bonus of 100 / 50 / 25 for finishing 1st / 2nd / 3rd.
          </p>
        </section>
      )}

      {!loading && !error && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Gaming Lab</h2>
          </div>
          <div className="stat-grid">
            {stats.map((st) => (
              <div className="stat" key={st.label}>
                <div className="stat-label">{st.label}</div>
                <div className="stat-value">
                  <CountUp value={st.value} decimals={st.decimals || 0} />
                  {st.suffix && <span className="stat-suffix">{st.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="card card-interactive"
            data-fx="tilt"
            style={{ marginTop: 12 }}
            onClick={() => onOpenDetail('game', null, 'Gaming Lab')}
          >
            <div className="row" style={{ gap: 14 }}>
              <span className="icon-tile is-violet"><IconGamepad size={18} /></span>
              <div style={{ flex: 1 }}>
                <div className="card-title">Match history</div>
                <p className="card-desc">Results, ranks, and opponents for every match you have played.</p>
              </div>
              <IconArrowRight size={16} style={{ color: 'var(--text-dim)' }} />
            </div>
          </button>
        </section>
      )}
    </div>
  );
}

export default SummaryGrid;
