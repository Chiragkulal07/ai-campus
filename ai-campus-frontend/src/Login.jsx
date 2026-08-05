import { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignup ? 'signup' : 'login';
    const body = isSignup ? { email, password, displayName } : { email, password };

    try {
      const res = await fetch(`http://localhost:4000/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.token, data.user);
    } catch {
      setLoading(false);
      setError('Could not reach the server — is the backend running?');
    }
  };

  const inp = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#f1f5f9', fontSize: '14px',
    marginBottom: '12px', display: 'block',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, #080c14 60%)',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Glow orbs */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: '400px', padding: '20px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            🎓
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9', marginBottom: '6px' }}>
            AI Campus
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {isSignup ? 'Create your account to enter the campus' : 'Sign in to continue to the campus'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', padding: '28px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '24px' }}>
            {isSignup ? 'Create Account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit}>
            <input
              type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={inp} required
            />

            {isSignup && (
              <input
                type="text" placeholder="Display name (shown to other players)"
                value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                style={inp} required
              />
            )}

            <input
              type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ ...inp, marginBottom: error ? '12px' : '20px' }} required
            />

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', marginBottom: '16px',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ Please wait...' : isSignup ? '🚀 Create Account' : '→ Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', color: '#475569', fontSize: '13px' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              style={{
                background: 'none', border: 'none', color: '#818cf8',
                cursor: 'pointer', fontWeight: 600, fontSize: '13px',
              }}
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;