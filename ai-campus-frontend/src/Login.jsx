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
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1.5px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14px',
    marginBottom: '14px',
    display: 'block',
    outline: 'none',
    transition: 'all 0.15s ease-in-out'
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.12) 0%, #090d16 70%)',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Glow orbs */}
      <div style={{
        position: 'fixed',
        top: '-15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '650px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
        filter: 'blur(30px)'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '24px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.45)',
          }}>
            🎓
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px', letterSpacing: '-0.8px' }}>
            AI Campus
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
            {isSignup ? 'Create your account to enter the campus' : 'Sign in to continue to the campus'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '36px 32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,255,255,0.01)',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '24px', letterSpacing: '-0.3px' }}>
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inp}
              onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 8px rgba(99,102,241,0.25)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
              required
            />

            {isSignup && (
              <input
                type="text"
                placeholder="Display name (shown to other players)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inp}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 8px rgba(99,102,241,0.25)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            )}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inp, marginBottom: error ? '14px' : '24px' }}
              onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 8px rgba(99,102,241,0.25)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
              required
            />

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: '1.4'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? 'rgba(99, 102, 241, 0.5)' : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.15s',
                outline: 'none'
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? '⏳ Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13.5px',
                padding: '2px 4px',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#818cf8'; }}
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