import React, { useState, useEffect, useRef } from 'react';

function PlayerCharacter({ player, isMe, isSpeaking = false, videoStream = null }) {
  const [isMoving, setIsMoving] = useState(false);
  const [facingRight, setFacingRight] = useState(true);
  const prevPos = useRef({ x: player.x, y: player.y });
  const videoRef = useRef(null);

  useEffect(() => {
    let dx = player.dx !== undefined ? player.dx : player.x - prevPos.current.x;
    let dy = player.dy !== undefined ? player.dy : player.y - prevPos.current.y;

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      setIsMoving(true);
    } else {
      setIsMoving(false);
    }

    if (dx > 0) {
      setFacingRight(true);
    } else if (dx < 0) {
      setFacingRight(false);
    }

    prevPos.current = { x: player.x, y: player.y };
  }, [player.x, player.y, player.dx, player.dy]);

  // Attach the video stream to the <video> element whenever it changes —
  // srcObject can't be set via a normal prop/attribute, has to be imperative.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = videoStream || null;
    }
  }, [videoStream]);

  const bodyColor = player.bodyColor || (isMe ? 'dodgerblue' : 'crimson');
  const hasVideo = !!videoStream;

  return (
    <div style={{
      position: 'absolute',
      left: player.x,
      top: player.y,
      textAlign: 'center',
      transform: 'translate(-50%, -50%)',
      transition: 'left 0.1s linear, top 0.1s linear',
      zIndex: player.y
    }}>
      {/* Video tile — floats above the character when camera is on */}
      {hasVideo && (
        <div style={{
          position: 'absolute',
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90px',
          height: '68px',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '2px solid #3b82f6',
          boxShadow: '0 0 14px rgba(59,130,246,0.6), 0 6px 16px rgba(0,0,0,0.5)',
          background: '#0b121f'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMe} // mute your own preview to avoid hearing yourself echo
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isMe ? 'scaleX(-1)' : 'none' // mirror only your own camera, like a selfie view
            }}
          />
        </div>
      )}

      {/* Speaking ring — sits behind the character, pulses while voice is detected */}
      {isSpeaking && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: '3px solid #10b981',
          boxShadow: '0 0 12px rgba(16,185,129,0.6)',
          animation: 'speakingPulse 0.9s ease-in-out infinite',
          zIndex: -1,
          pointerEvents: 'none'
        }} />
      )}

      <div
        className={isMoving ? '' : 'character-idle'}
        style={{
          transform: `scaleX(${facingRight ? 1 : -1})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transformOrigin: 'bottom center',
        }}
      >
        <div style={{ position: 'relative', width: '32px', height: '48px' }}>
          <div className={isMoving ? 'swing-back' : ''} style={{
            position: 'absolute', top: '20px', left: '12px', width: '8px', height: '14px',
            backgroundColor: '#d8b080', border: '2px solid #333', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 0,
          }} />
          <div className={isMoving ? 'swing-back' : ''} style={{
            position: 'absolute', top: '34px', left: '6px', width: '8px', height: '14px',
            backgroundColor: '#2d4373', border: '2px solid #333', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 0,
          }} />
          <div style={{
            position: 'absolute', top: '20px', left: '4px', width: '24px', height: '16px',
            backgroundColor: bodyColor, border: '2px solid #333', borderRadius: '2px', zIndex: 1,
          }} />
          <div style={{
            position: 'absolute', top: 0, left: '6px', width: '20px', height: '20px',
            backgroundColor: '#ffdbac', border: '2px solid #333', borderRadius: '2px', zIndex: 2,
          }}>
            <div style={{
              position: 'absolute', top: '4px', right: '4px', width: '4px', height: '4px',
              backgroundColor: '#000',
            }} />
          </div>
          <div className={isMoving ? 'swing-front' : ''} style={{
            position: 'absolute', top: '34px', left: '16px', width: '8px', height: '14px',
            backgroundColor: '#3b5998', border: '2px solid #333', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 1,
          }} />
          <div className={isMoving ? 'swing-front' : ''} style={{
            position: 'absolute', top: '20px', left: '12px', width: '8px', height: '14px',
            backgroundColor: '#ffdbac', border: '2px solid #333', borderRadius: '2px',
            transformOrigin: 'top center', zIndex: 3,
          }} />
        </div>
      </div>

      <div style={{
        fontSize: '13px',
        marginTop: '6px',
        fontWeight: 'bold',
        color: isSpeaking ? '#10b981' : 'white',
        textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px'
      }}>
        {isSpeaking && <span style={{ fontSize: '11px' }}>🔊</span>}
        {player.displayName || player.id.slice(0, 5)}
      </div>

      <style>{`
        @keyframes walkFront {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(40deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-40deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes walkBack {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-40deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(40deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes blockyIdle {
          0% { transform: translateY(0px); }
          100% { transform: translateY(3px); }
        }
        @keyframes speakingPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.5; }
        }
        .swing-front {
          animation: walkFront 0.4s infinite linear;
        }
        .swing-back {
          animation: walkBack 0.4s infinite linear;
        }
        .character-idle {
          animation: blockyIdle 0.8s steps(2, end) infinite alternate;
        }
      `}</style>
    </div>
  );
}

export default PlayerCharacter;