import { useState, useEffect, useRef } from 'react';
import { API_URL } from './config';

function Login({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  // Background particle nebula
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 0.6,
      speedY: Math.random() * 0.4 + 0.1,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.7 + 0.2,
      color: Math.random() > 0.5 ? '#c084fc' : Math.random() > 0.3 ? '#38bdf8' : '#fde047'
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        if (p.y < 0) {
          p.y = canvas.height;
          p.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignup ? 'signup' : 'login';
    const body = isSignup ? { email, password, displayName } : { email, password };

    try {
      const res = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Authentication error');
        return;
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.token, data.user);
    } catch {
      setLoading(false);
      setError('Could not reach the uplink server. Ensure the backend node is running.');
    }
  };

  const inp = {
    width: '100%',
    padding: '14px 18px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '14.5px',
    marginBottom: '16px',
    display: 'block',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#04060e',
      backgroundImage: `
        radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.16) 0%, transparent 65%),
        radial-gradient(circle at 80% 80%, rgba(34, 211, 238, 0.12) 0%, transparent 55%),
        radial-gradient(circle at 20% 70%, rgba(168, 85, 247, 0.14) 0%, transparent 55%)
      `,
      fontFamily: "'Outfit', 'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Main Holographic Terminal Card */}
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: '960px',
        background: 'rgba(11, 17, 33, 0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1.5px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '28px',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.25), inset 0 0 30px rgba(99, 102, 241, 0.08)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Glowing Top Edge Line */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px',
          background: 'linear-gradient(90deg, transparent, #c084fc, #38bdf8, transparent)',
          opacity: 0.9
        }} />

        {/* Left Side: Cyber-Campus Telemetry & World Lore */}
        <div style={{
          flex: 1.1,
          padding: '48px',
          background: 'linear-gradient(135deg, rgba(20, 26, 48, 0.75) 0%, rgba(10, 15, 30, 0.88) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                🎓
              </div>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.4px' }}>
                Robo<span style={{ color: '#38bdf8' }}>Campus</span>
              </span>
            </div>

            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', lineHeight: '1.2', marginBottom: '14px', letterSpacing: '-0.8px' }}>
              Enter the <br />
              <span style={{
                background: 'linear-gradient(90deg, #c084fc, #38bdf8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 16px rgba(192, 132, 252, 0.4))'
              }}>
                Voxel Holographic Sky
              </span>
            </h2>

            <p style={{ color: '#94a3b8', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '32px' }}>
              Step into floating sky-island research labs. Engage in laser battlefield matches, discover AI learning roadmaps, and interact in real-time.
            </p>

            {/* Feature Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13.5px' }}>
                <span style={{ color: '#c084fc', fontSize: '16px' }}>🕹️</span>
                <span><strong>Gaming Lab:</strong> Live multiplayer 2D arena combat</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13.5px' }}>
                <span style={{ color: '#38bdf8', fontSize: '16px' }}>🗺️</span>
                <span><strong>Roadmap Lab:</strong> Graph-driven AI skill curriculum</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13.5px' }}>
                <span style={{ color: '#34d399', fontSize: '16px' }}>🌐</span>
                <span><strong>Voxel Mesh:</strong> Real-time voice, video, & spatial presence</span>
              </div>
            </div>
          </div>

          {/* Telemetry Console */}
          <div style={{
            background: 'rgba(5, 8, 18, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px 20px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#a5b4fc',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>TERMINAL GATEWAY:</span>
              <span style={{ color: '#34d399', fontWeight: 800 }}>ACTIVE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>SKY ISLAND MESH:</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>SYNCHRONIZED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>LATENCY COMPENSATION:</span>
              <span style={{ color: '#c084fc', fontWeight: 800 }}>OPTIMIZED</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
              <span>&gt;</span>
              <span>READY FOR AUTHENTICATION</span>
              <span style={{ width: '8px', height: '12px', background: '#38bdf8', display: 'inline-block', animation: 'pulse-ring 1.5s infinite' }} />
            </div>
          </div>
        </div>

        {/* Right Side: Authentication Form */}
        <div style={{
          flex: 1,
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(8, 12, 24, 0.4)'
        }}>
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', marginBottom: '6px', letterSpacing: '-0.5px' }}>
              {isSignup ? 'Create Pilot Profile' : 'Uplink Terminal'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13.5px' }}>
              {isSignup ? 'Deploy your avatar to start exploring' : 'Enter credentials to connect to Campus World'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inp}
                onFocus={(e) => {
                  e.target.style.borderColor = '#38bdf8';
                  e.target.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            {isSignup && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Pilot Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={inp}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#c084fc';
                    e.target.style.boxShadow = '0 0 16px rgba(192, 132, 252, 0.4)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inp, marginBottom: error ? '14px' : '24px' }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#38bdf8';
                  e.target.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                borderRadius: '12px',
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
                background: loading
                  ? 'rgba(99, 102, 241, 0.4)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '0.3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 8px 25px rgba(124, 58, 237, 0.45), 0 0 15px rgba(6, 182, 212, 0.3)',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(124, 58, 237, 0.6), 0 0 22px rgba(6, 182, 212, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(124, 58, 237, 0.45), 0 0 15px rgba(6, 182, 212, 0.3)';
                }
              }}
            >
              {loading ? '⏳ Synchronizing Node...' : isSignup ? '🚀 Create & Enter Campus' : '⚡ Connect Terminal'}
            </button>
          </form>

          {/* Toggle Button */}
          <p style={{ textAlign: 'center', marginTop: '24px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
            {isSignup ? 'Already have credentials?' : 'New developer to the campus?'}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '13.5px',
                padding: '2px 4px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#c084fc'; e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.textDecoration = 'none'; }}
            >
              {isSignup ? 'Sign in here' : 'Register pilot here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;