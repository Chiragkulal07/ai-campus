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
      background: '#040711',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      
      {/* Global CSS animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(30px, -40px) scale(1.15); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translate(0px, 0px) scale(1.1); }
          50% { transform: translate(-40px, 30px) scale(0.9); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes terminal-blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Floating background neon orbs */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
        animation: 'float-slow 8s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '10%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'float-slower 12s ease-in-out infinite',
        pointerEvents: 'none'
      }} />

      {/* Main split-panel container */}
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: '920px',
        background: 'rgba(10, 15, 30, 0.45)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '28px',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2
      }}>
        
        {/* Left Side: Developer Info Console / HUD (Visible on screens larger than mobile) */}
        <div style={{
          flex: 1.1,
          padding: '48px',
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.75) 0%, rgba(9, 15, 30, 0.9) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Scanline Overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 6px 100%',
            pointerEvents: 'none',
            opacity: 0.15
          }} />

          {/* Top Panel Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                🎓
              </div>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
                AI CAMPUS
              </span>
            </div>

            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', lineHeight: '1.2', marginBottom: '16px', letterSpacing: '-1px' }}>
              Welcome to the <br />
              <span style={{ background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Holographic Sandbox
              </span>
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '36px' }}>
              Connect with fellow developers in our sandbox world. Create coding labs, play retro laser matches, and share voice meshes.
            </p>
          </div>

          {/* Console Output Statistics */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '20px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#818cf8'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>SYSTEM STATUS:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>ONLINE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>VOICE LINK NODE:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>ACTIVE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>BATTLEFIELD MESH:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>STABLE</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '12px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
              <span>&gt;</span>
              <span>UPLINK CONNECT READY</span>
              <span style={{ width: '8px', height: '12px', background: '#6366f1', display: 'inline-block', animation: 'terminal-blink 1s infinite' }} />
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Forms */}
        <div style={{
          flex: 1,
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'transparent'
        }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px', letterSpacing: '-0.5px' }}>
              {isSignup ? 'Initialize Account' : 'Uplink Terminal'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '13.5px' }}>
              {isSignup ? 'Setup credentials to get started' : 'Sign in to access your dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            
            {/* Input Wrapper (Email) */}
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inp}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 10px rgba(99,102,241,0.2)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            {/* Input Wrapper (Display Name) */}
            {isSignup && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={inp}
                  onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 10px rgba(99,102,241,0.2)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>
            )}

            {/* Input Wrapper (Password) */}
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inp, marginBottom: error ? '12px' : '24px' }}
                onFocus={(e) => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 10px rgba(99,102,241,0.2)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                borderRadius: '10px',
                padding: '12px 14px',
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
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 6px 20px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.15s',
                outline: 'none'
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? '⏳ Accessing Node...' : isSignup ? 'Initialize Uplink' : 'Connect Terminal'}
            </button>
          </form>

          {/* Toggle Button */}
          <p style={{ textAlign: 'center', marginTop: '24px', color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
            {isSignup ? 'Already registered?' : 'Need an entry node?'}{' '}
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
              {isSignup ? 'Uplink here' : 'Initialize here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;