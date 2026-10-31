import { useState } from 'react';
import { API_URL } from './config';
import { readJson } from './utils';
import { IconAlert, IconGrad } from './icons';
import { SplitWords } from './fx';

// Animated campus map for the sign-in showcase: three labs joined by a
// route that draws itself, with a light travelling along it.
function CampusMap() {
  const route = 'M 60 150 C 140 150, 150 60, 250 60 S 360 150, 460 110';
  return (
    <svg className="auth-map" viewBox="0 0 520 200" aria-hidden="true">
      <path className="am-track" d={route} />
      <path className="am-route" d={route} pathLength="100" />
      <circle className="am-comet" r="4">
        <animateMotion dur="3.2s" begin="2.7s" repeatCount="indefinite" path={route} />
      </circle>

      {[
        { x: 60, y: 150, c: '#f59e0b', label: 'Campus', meta: 'Meet people live' },
        { x: 250, y: 60, c: '#fb923c', label: 'Gaming Lab', meta: 'Multiplayer arena' },
        { x: 460, y: 110, c: '#5eead4', label: 'Roadmap Lab', meta: 'Learning paths' },
      ].map((n) => (
        <g key={n.label} className="am-node">
          <circle className="am-halo" cx={n.x} cy={n.y} r="12" fill="none" stroke={n.c} strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r="9" fill="#151312" stroke={n.c} strokeWidth="2.5" />
          <circle cx={n.x} cy={n.y} r="3.5" fill={n.c} />
          <text className="am-label" x={n.x} y={n.y + 30} textAnchor="middle">{n.label}</text>
          <text className="am-meta" x={n.x} y={n.y + 45} textAnchor="middle">{n.meta}</text>
        </g>
      ))}
    </svg>
  );
}

function Login({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const endpoint = isSignup ? 'signup' : 'login';
    const body = isSignup
      ? { email: email.trim(), password, displayName: displayName.trim() }
      : { email: email.trim(), password };

    try {
      const res = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJson(res);

      if (!res.ok || !data.token) {
        setError(data.error || (isSignup ? 'Could not create your account.' : 'Incorrect email or password.'));
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.token, data.user);
    } catch {
      setLoading(false);
      setError('Unable to reach the server. Check your connection and try again.');
    }
  };

  const setMode = (signup) => {
    if (signup === isSignup || loading) return;
    setIsSignup(signup);
    setError('');
  };

  return (
    <div className="auth">
      {/* Showcase (hidden on narrow screens) */}
      <aside className="auth-showcase">
        <div className="row" style={{ gap: 10 }}>
          <span className="brand-mark" style={{ width: 32, height: 32 }}><IconGrad size={18} /></span>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-strong)' }}>RoboCampus</span>
        </div>

        <div>
          <h1 className="auth-headline">
            <SplitWords text="Walk the campus." delay={150} />{' '}
            <em><SplitWords text="Play, learn and meet." delay={450} /></em>
          </h1>
          <p className="auth-sub">
            Explore a shared world, join live arena matches, and build a learning roadmap for any topic.
          </p>
          <CampusMap />
        </div>

        <div className="auth-features">
          <span style={{ '--c': '#f59e0b' }}><i />Voice and video on campus</span>
          <span style={{ '--c': '#fb923c' }}><i />Real-time matches</span>
          <span style={{ '--c': '#5eead4' }}><i />Step-by-step roadmaps</span>
        </div>
      </aside>

      {/* Form */}
      <main className="auth-panel">
        <div className="auth-form-wrap">
          <div className="row" style={{ gap: 10, marginBottom: 24 }}>
            <span className="brand-mark" style={{ width: 30, height: 30 }}><IconGrad size={16} /></span>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-strong)' }}>RoboCampus</span>
          </div>

          <div>
            <h2 className="page-title" key={isSignup ? 'su' : 'si'}>
              <SplitWords text={isSignup ? 'Create your account' : 'Welcome back'} />
            </h2>
            <p className="muted" style={{ marginTop: 6, marginBottom: 22 }}>
              {isSignup ? 'It takes less than a minute.' : 'Sign in to continue to your campus.'}
            </p>
          </div>

          <div className={`segmented ${isSignup ? 'is-right' : ''}`} role="tablist" aria-label="Account">
            <span className="segmented-thumb" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'is-active' : ''} onClick={() => setMode(false)}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'is-active' : ''} onClick={() => setMode(true)}>
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
            <div className="auth-fields" key={isSignup ? 'signup' : 'signin'}>
              {isSignup && (
                <div className="field field-reveal">
                  <label className="label" htmlFor="displayName">Display name</label>
                  <input
                    id="displayName"
                    className="input"
                    type="text"
                    autoComplete="nickname"
                    placeholder="How others will see you"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={32}
                    required
                  />
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'Choose a password' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="alert" role="alert" style={{ marginTop: 16 }}>
                <IconAlert size={15} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }}>
              {loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
              {loading
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (isSignup ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <p className="dim" style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5 }}>
            {isSignup ? 'Already have an account? Switch to Sign in above.' : 'New here? Choose Create account above.'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default Login;
