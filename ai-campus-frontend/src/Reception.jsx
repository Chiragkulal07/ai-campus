import { useEffect, useState } from 'react';
import { API_URL } from './config';
import { initialOf, readJson } from './utils';
import useGames from './useGames';
import GameRow from './GameRow';
import BackButton from './BackButton';
import { CountUp, SplitWords } from './fx';
import { IconAlert, IconArrowRight, IconGamepad, IconRoute, IconRefresh } from './icons';

function Reception({ me, token, onEnterGamingLab, onEnterRoadmapLab, onEnterBattlefield, onOpenSummary, onBack, backLabel }) {
  const { games, loading, error, joiningId, loadGames, joinGame } = useGames(token, onEnterBattlefield);
  const [stats, setStats] = useState(null); // null until the backend responds

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/profile/me/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || 'Could not load stats');
        return data;
      })
      .then((data) => { if (!cancelled && data?.gamingLab) setStats(data.gamingLab); })
      .catch(() => { /* leave stats null: tiles show "–" instead of fake zeros */ });
    return () => { cancelled = true; };
  }, [token]);

  const matches = stats ? stats.totalMatches ?? 0 : '–';
  const kills = stats ? stats.totalKills ?? 0 : '–';
  const avg = stats ? stats.avgKills ?? 0 : '–';

  return (
    <div className="page">
      {onBack && <BackButton onClick={onBack} label={backLabel} className="page-back" />}
      <div className="page-header">
        <div className="row" style={{ gap: 14 }}>
          <span className="avatar-orbit">
            <span className="avatar avatar-lg" style={{ background: me.avatar?.bodyColor || 'var(--accent)' }}>
              {initialOf(me.displayName)}
            </span>
          </span>
          <div>
            <h1 className="page-title"><SplitWords text={`Welcome back, ${me.displayName}`} /></h1>
            <p className="page-subtitle">Level {me.profile?.level || 1} · {me.profile?.xp || 0} XP</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onOpenSummary}>
          View stats <IconArrowRight size={15} />
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Matches played</div>
          <div className="stat-value"><CountUp value={matches} /></div>
        </div>
        <div className="stat">
          <div className="stat-label">Total kills</div>
          <div className="stat-value"><CountUp value={kills} /></div>
        </div>
        <div className="stat">
          <div className="stat-label">Kills per match</div>
          <div className="stat-value"><CountUp value={avg} decimals={1} /></div>
        </div>
        <div className="stat">
          <div className="stat-label">Open matches</div>
          <div className="stat-value">{loading ? '–' : <CountUp value={games.length} />}</div>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Labs</h2>
        </div>
        <div className="grid-2">
          <button type="button" className="card card-interactive" data-fx="tilt" onClick={onEnterGamingLab}>
            <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              <span className="icon-tile is-violet"><IconGamepad size={18} /></span>
              <div style={{ flex: 1 }}>
                <div className="card-title">Gaming Lab</div>
                <p className="card-desc">Host or join real-time multiplayer arena matches.</p>
              </div>
              <IconArrowRight size={16} style={{ color: 'var(--text-dim)', marginTop: 2 }} />
            </div>
          </button>

          <button type="button" className="card card-interactive" data-fx="tilt" onClick={onEnterRoadmapLab}>
            <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              <span className="icon-tile is-cyan"><IconRoute size={18} /></span>
              <div style={{ flex: 1 }}>
                <div className="card-title">Roadmap Lab</div>
                <p className="card-desc">Generate a step-by-step learning path for any topic.</p>
              </div>
              <IconArrowRight size={16} style={{ color: 'var(--text-dim)', marginTop: 2 }} />
            </div>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Open matches</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadGames} disabled={loading}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 12 }}>
            <IconAlert size={15} /><span>{error}</span>
          </div>
        )}

        {loading && games.length === 0 && (
          <div className="loading-row"><span className="spinner" /> Loading matches…</div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="empty-state">
            <span className="icon-tile"><IconGamepad size={18} /></span>
            <div className="empty-state-title">No open matches</div>
            <p className="empty-state-desc">Create one in the Gaming Lab and invite others to join.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={onEnterGamingLab}>
              Go to Gaming Lab
            </button>
          </div>
        )}

        <div className="stack">
          {games.map((g) => (
            <GameRow key={g.id} game={g} joining={joiningId === g.id} onJoin={joinGame} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default Reception;
