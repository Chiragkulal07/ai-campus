import { useState, useEffect, useRef } from 'react';

function PlayerCharacter({ player, isMe, isSpeaking = false, videoStream = null }) {
  const [isMoving, setIsMoving] = useState(false);
  const [facingRight, setFacingRight] = useState(true);
  const prevPos = useRef({ x: player.x, y: player.y });
  const videoRef = useRef(null);

  const idleTimerRef = useRef(null);

  // Walk animation follows actual position changes, not just the last input:
  // if the character hasn't moved for a short moment, it goes idle even when
  // no explicit "stopped" update arrives.
  useEffect(() => {
    const movedX = player.x - prevPos.current.x;
    const movedY = player.y - prevPos.current.y;
    const hasMoved = Math.abs(movedX) > 0.1 || Math.abs(movedY) > 0.1;
    const inputStopped = player.dx === 0 && player.dy === 0;

    clearTimeout(idleTimerRef.current);
    if (hasMoved && !inputStopped) {
      setIsMoving(true);
      // Server ticks every 100ms; no new position for ~250ms means we stopped.
      idleTimerRef.current = setTimeout(() => setIsMoving(false), 250);
    } else {
      setIsMoving(false);
    }

    const faceDx = player.dx ? player.dx : movedX;
    if (faceDx > 0) {
      setFacingRight(true);
    } else if (faceDx < 0) {
      setFacingRight(false);
    }

    prevPos.current = { x: player.x, y: player.y };
  }, [player.x, player.y, player.dx, player.dy]);

  useEffect(() => () => clearTimeout(idleTimerRef.current), []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream || null;
    }
  }, [videoStream]);

  const bodyColor = player.bodyColor || (isMe ? '#d97706' : '#9333ea');
  const hasVideo = !!videoStream;

  return (
    <div style={{
      position: 'absolute',
      left: player.x,
      top: player.y,
      textAlign: 'center',
      transform: 'translate(-50%, -85%)',
      transition: 'left 0.1s linear, top 0.1s linear',
      zIndex: Math.round(player.y) + 50,
      pointerEvents: 'none'
    }}>
      {/* Video tile — floats above character when camera is active */}
      {hasVideo && (
        <div style={{
          position: 'absolute',
          bottom: '82px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '94px',
          height: '70px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #fbbf24',
          boxShadow: '0 0 16px rgba(251, 191, 36, 0.7), 0 8px 20px rgba(0,0,0,0.6)',
          background: '#151312',
          zIndex: 100
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMe}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isMe ? 'scaleX(-1)' : 'none'
            }}
          />
        </div>
      )}

      {/* Speaking ring — pulses when voice is detected */}
      {isSpeaking && (
        <div style={{
          position: 'absolute',
          top: '36%',
          left: '50%',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2.5px solid #10b981',
          boxShadow: '0 0 16px rgba(16, 185, 129, 0.8)',
          animation: 'speakingPulse 0.9s ease-in-out infinite',
          zIndex: -1,
          pointerEvents: 'none'
        }} />
      )}

      {/* Floating Name Badge */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        marginBottom: '6px',
        color: isSpeaking ? '#34d399' : '#f5f5f4',
        background: isMe ? 'rgba(28, 25, 23, 0.85)' : 'rgba(41, 37, 36, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '2px 9px',
        borderRadius: '10px',
        border: `1px solid ${isMe ? 'rgba(251, 191, 36, 0.4)' : 'rgba(192, 132, 252, 0.4)'}`,
        boxShadow: `0 4px 12px rgba(0, 0, 0, 0.7), 0 0 8px ${isMe ? 'rgba(251, 191, 36, 0.25)' : 'rgba(192, 132, 252, 0.25)'}`,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        letterSpacing: '0.2px'
      }}>
        {isSpeaking && <span style={{ fontSize: '10px' }}>🔊</span>}
        {player.displayName || player.id.slice(0, 5)}
        {isMe && <span style={{ color: '#fbbf24', fontSize: '9px', fontWeight: 800 }}>YOU</span>}
      </div>

      {/* Character body */}
      <div
        className={isMoving ? '' : 'character-idle'}
        style={{
          transform: `scaleX(${facingRight ? 1 : -1})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transformOrigin: 'bottom center',
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))'
        }}
      >
        <div style={{ position: 'relative', width: '30px', height: '46px' }}>
          {/* Back arm */}
          <div className={isMoving ? 'swing-back' : ''} style={{
            position: 'absolute', top: '18px', left: '10px', width: '7px', height: '14px',
            backgroundColor: '#d8b080', border: '1.5px solid #292524', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 0,
          }} />
          {/* Back leg */}
          <div className={isMoving ? 'swing-back' : ''} style={{
            position: 'absolute', top: '32px', left: '6px', width: '7px', height: '14px',
            backgroundColor: '#292524', border: '1.5px solid #1c1917', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 0,
          }} />
          {/* Torso / Jacket */}
          <div style={{
            position: 'absolute', top: '18px', left: '4px', width: '22px', height: '16px',
            backgroundColor: bodyColor, border: '1.5px solid #1c1917', borderRadius: '2px', zIndex: 1,
            boxShadow: `inset 0 0 6px rgba(0,0,0,0.25), 0 0 8px ${bodyColor}40`
          }}>
            {/* Jacket collar / zipper detail */}
            <div style={{
              position: 'absolute', top: 0, left: '9px', width: '4px', height: '14px',
              backgroundColor: '#f5f5f4', opacity: 0.8
            }} />
          </div>
          {/* Head */}
          <div style={{
            position: 'absolute', top: 0, left: '5px', width: '20px', height: '20px',
            backgroundColor: '#ffdbac', border: '1.5px solid #1c1917', borderRadius: '3px', zIndex: 2,
          }}>
            {/* Hair */}
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '6px',
              backgroundColor: '#451a03', borderRadius: '2px 2px 0 0'
            }} />
            {/* Eyes */}
            <div style={{
              position: 'absolute', top: '8px', right: '4px', width: '4px', height: '4px',
              backgroundColor: '#1c1917', borderRadius: '1px'
            }} />
          </div>
          {/* Front leg */}
          <div className={isMoving ? 'swing-front' : ''} style={{
            position: 'absolute', top: '32px', left: '15px', width: '7px', height: '14px',
            backgroundColor: '#44403c', border: '1.5px solid #1c1917', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 1,
          }} />
          {/* Front arm */}
          <div className={isMoving ? 'swing-front' : ''} style={{
            position: 'absolute', top: '18px', left: '11px', width: '7px', height: '14px',
            backgroundColor: '#ffdbac', border: '1.5px solid #292524', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 3,
          }} />
        </div>
      </div>

      {/* Glowing Cyan/Blue Floor Ring under feet (as in Image 2) */}
      <div style={{
        position: 'absolute',
        bottom: '-4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '38px',
        height: '14px',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.45) 0%, rgba(245, 158, 11, 0.15) 60%, transparent 80%)',
        border: '1.5px solid rgba(251, 191, 36, 0.75)',
        boxShadow: '0 0 14px rgba(251, 191, 36, 0.8), inset 0 0 6px rgba(251, 191, 36, 0.5)',
        animation: 'portalRingPulse 2.2s ease-in-out infinite alternate',
        pointerEvents: 'none',
        zIndex: -1
      }} />

      <style>{`
        @keyframes walkFront {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(35deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-35deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes walkBack {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-35deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(35deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes blockyIdle {
          0% { transform: translateY(0px); }
          100% { transform: translateY(2px); }
        }
        @keyframes speakingPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.18); opacity: 0.4; }
        }
        @keyframes portalRingPulse {
          0% { transform: translateX(-50%) scale(1); opacity: 0.8; box-shadow: 0 0 12px rgba(251, 191, 36, 0.7); }
          100% { transform: translateX(-50%) scale(1.12); opacity: 1; box-shadow: 0 0 18px rgba(251, 191, 36, 0.95); }
        }
        .swing-front {
          animation: walkFront 0.35s infinite linear;
        }
        .swing-back {
          animation: walkBack 0.35s infinite linear;
        }
        .character-idle {
          animation: blockyIdle 0.9s steps(2, end) infinite alternate;
        }
      `}</style>
    </div>
  );
}

export default PlayerCharacter;