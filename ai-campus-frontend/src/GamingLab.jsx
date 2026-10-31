import { useState } from 'react';
import { API_URL } from './config';
import { readJson } from './utils';
import useGames from './useGames';
import GameRow from './GameRow';
import BackButton from './BackButton';
import { SplitWords } from './fx';
import { IconAlert, IconGamepad, IconPlus, IconRefresh, IconX } from './icons';

const PLAYER_MIN = 2;
const PLAYER_MAX = 8;
const DURATION_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 180, label: '3 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
];

function GamingLab({ token, onEnterBattlefield, onBack, backLabel }) {
  const { games, loading, error, setError, joiningId, loadGames, joinGame } = useGames(token, onEnterBattlefield);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [durationSec, setDurationSec] = useState(120);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const closeForm = () => {
    setShowCreate(false);
    setFormError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setFormError('Enter a match name.'); return; }
    const players = Math.min(PLAYER_MAX, Math.max(PLAYER_MIN, Number(maxPlayers) || PLAYER_MIN));

    setCreating(true);
    setFormError('');
    setError('');
    try {
      const res = await fetch(`${API_URL}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed, maxPlayers: players, durationSec: Number(durationSec) }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setFormError(data.error || 'Could not create the match.');
        return;
      }
      setName('');
      setShowCreate(false);
      loadGames();
    } catch {
      setFormError('Unable to reach the server.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page page-narrow">
      {onBack && <BackButton onClick={onBack} label={backLabel} className="page-back" />}
      <div className="page-header">
        <div>
          <h1 className="page-title"><SplitWords text="Gaming Lab" /></h1>
          <p className="page-subtitle">Real-time multiplayer arena. Create a match or join an open one.</p>
        </div>
        {!showCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <IconPlus size={15} /> New match
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 24, animation: 'fadeInUp 0.2s var(--ease)' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="card-title">New match</h2>
            <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close">
              <IconX size={15} />
            </button>
          </div>

          <div className="field">
            <label className="label" htmlFor="match-name">Match name</label>
            <input
              id="match-name"
              className="input"
              type="text"
              placeholder="e.g. Friday evening match"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 14 }}>
            <div className="field" style={{ marginTop: 0 }}>
              <label className="label" htmlFor="match-players">Max players</label>
              <input
                id="match-players"
                className="input"
                type="number"
                min={PLAYER_MIN}
                max={PLAYER_MAX}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                onBlur={() => setMaxPlayers((v) => Math.min(PLAYER_MAX, Math.max(PLAYER_MIN, Number(v) || PLAYER_MIN)))}
              />
              <span className="hint">Between {PLAYER_MIN} and {PLAYER_MAX}</span>
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label className="label" htmlFor="match-duration">Duration</label>
              <select
                id="match-duration"
                className="input"
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {formError && (
            <div className="alert" style={{ marginTop: 16 }}><IconAlert size={15} /><span>{formError}</span></div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create match'}
            </button>
          </div>
        </form>
      )}

      <section>
        <div className="section-header">
          <h2 className="section-title">
            Open matches{games.length > 0 && <span className="dim"> · {games.length}</span>}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadGames} disabled={loading}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 12 }}><IconAlert size={15} /><span>{error}</span></div>
        )}

        {loading && games.length === 0 && (
          <div className="loading-row"><span className="spinner" /> Loading matches…</div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="empty-state">
            <span className="icon-tile"><IconGamepad size={18} /></span>
            <div className="empty-state-title">No open matches</div>
            <p className="empty-state-desc">Create a match to get started. Others can join from here or the dashboard.</p>
            {!showCreate && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <IconPlus size={14} /> New match
              </button>
            )}
          </div>
        )}

        <div className="stack">
          {games.map((g) => (
            <GameRow key={g.id} game={g} joining={joiningId === g.id} onJoin={joinGame} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header"><h2 className="section-title">How to play</h2></div>
        <div className="card" style={{ padding: 0 }}>
          {[
            ['Move', 'W A S D or arrow keys'],
            ['Aim', 'Mouse'],
            ['Fire', 'Hold left click or Space'],
            ['Damage', '20 HP per hit · respawn after 3 s'],
          ].map(([k, v], i) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13.5 }}>
              <span className="muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default GamingLab;
