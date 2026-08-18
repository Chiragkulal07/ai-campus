import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerCharacter from './PlayerCharacter';

function CampusWorld({ labs = [], players, myPlayerId, heldKeys, sendMoveInput, onEnterBuilding, speakingPeerIds = [], remoteVideoStreams = {}, myVideoStream = null }) {
  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 1600;

  const myPlayer = players.find((p) => p.id === myPlayerId) || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const offsetX = viewport.w / 2 - myPlayer.x;
  const offsetY = viewport.h / 2 - myPlayer.y;

  const btnBase = {
    width: '44px',
    height: '44px',
    fontSize: '16px',
    cursor: 'pointer',
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#94a3b8',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    userSelect: 'none',
    outline: 'none'
  };

  const makeBtn = (key, label) => ({
    onMouseDown:  () => { heldKeys.current[key] = true;  sendMoveInput(); },
    onMouseUp:    () => { heldKeys.current[key] = false; sendMoveInput(); },
    onMouseLeave: () => { heldKeys.current[key] = false; sendMoveInput(); },
    onTouchStart: (e) => { e.preventDefault(); heldKeys.current[key] = true;  sendMoveInput(); },
    onTouchEnd:   () => { heldKeys.current[key] = false; sendMoveInput(); },
    style: btnBase,
    children: label,
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      zIndex: 0,
      backgroundColor: '#0b121f',
      backgroundImage: `
        radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 80%),
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
      `,
      backgroundSize: '100% 100%, 50px 50px, 50px 50px',
    }}>

      {/* World Container */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${WORLD_WIDTH}px`,
        height: `${WORLD_HEIGHT}px`,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        transition: 'transform 0.1s linear',
      }}>
        {/* Receptionist */}
        <Receptionist x={200} y={200} playerX={myPlayer.x} playerY={myPlayer.y} />

        {/* Scenery (Trees) */}
        <Tree x={200} y={500} />
        <Tree x={800} y={200} />
        <Tree x={1100} y={450} />
        <Tree x={1500} y={250} />
        <Tree x={2100} y={400} />
        <Tree x={300} y={900} />
        <Tree x={900} y={1300} />
        <Tree x={1400} y={1000} />
        <Tree x={2200} y={900} />
        <Tree x={2000} y={1450} />

        {/* Gaming Lab Center Building */}
        <Building
          id="gaminglab"
          x={800}
          y={600}
          name="Gaming Lab"
          color="#3b82f6"
          playerX={myPlayer.x}
          playerY={myPlayer.y}
          onEnter={onEnterBuilding}
          emoji="🕹️"
        />

        {/* Buildings dynamically generated from backend labs list */}
        {labs.map(lab => {
          const isInterview = lab.id === 'INTERVIEW_HALL';
          const xVal = lab.mapConfig?.x ?? 800;
          const yVal = lab.mapConfig?.y ?? 300;
          const colorVal = isInterview ? '#f59e0b' : (lab.mapConfig?.color ?? '#8b5cf6');
          const emojiVal = isInterview ? '🎤' : '🏛️';
          return (
            <Building
              key={lab.id}
              id={lab.id}
              x={xVal}
              y={yVal}
              name={lab.name}
              color={colorVal}
              playerX={myPlayer.x}
              playerY={myPlayer.y}
              onEnter={onEnterBuilding}
              emoji={emojiVal}
            />
          );
        })}

        {/* Players */}
        {players.map((p) => (
          <PlayerCharacter
            key={p.id}
            player={p}
            isMe={p.id === myPlayerId}
            isSpeaking={speakingPeerIds.includes(p.id)}
            videoStream={p.id === myPlayerId ? myVideoStream : remoteVideoStreams[p.id]}
          />
        ))}
      </div>

      {/* Movement HUD */}
      <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
          <button
            {...makeBtn('up', '↑')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button
            {...makeBtn('left', '←')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
          <button
            {...makeBtn('down', '↓')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
          <button
            {...makeBtn('right', '→')}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginTop: '6px', fontFamily: "'Inter',sans-serif" }}>
          Arrow keys or buttons
        </p>
      </div>
    </div>
  );
}

function Building({ id, x, y, name, color, playerX, playerY, onEnter, emoji }) {
  const distance = Math.hypot(x - playerX, y - playerY);
  const isNear = distance < 160;

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      width: '280px',
      height: '200px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      zIndex: 10
    }}>
      {/* Floating Prompt */}
      <AnimatePresence>
        {isNear && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.85 }}
            animate={{ opacity: 1, y: -25, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.85 }}
            style={{
              position: 'absolute',
              top: '-45px',
              zIndex: 30
            }}
          >
            <button
              onClick={() => onEnter(id, name)}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                backgroundColor: '#ffffff',
                color: '#1e1b4b',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(255,255,255,0.35)',
                whiteSpace: 'nowrap',
                pointerEvents: 'auto',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              🔌 Connect to {name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyber Hub Structure */}
      <div style={{
        position: 'relative',
        width: '210px',
        height: '140px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(12px)',
        border: `2px solid ${color}`,
        borderRadius: '24px 24px 16px 16px',
        boxShadow: `0 15px 40px rgba(0,0,0,0.6), 0 0 25px ${color}33, inset 0 0 20px ${color}1a`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '16px'
      }}>
        {/* Floating Holo-ring at the top */}
        <div style={{
          position: 'absolute',
          top: '-10px',
          width: '120px',
          height: '6px',
          background: color,
          borderRadius: '50%',
          boxShadow: `0 0 15px ${color}, 0 0 5px ${color}`,
          opacity: 0.8
        }} />

        {emoji && (
          <div style={{
            fontSize: '28px',
            marginBottom: '2px',
            filter: `drop-shadow(0 0 8px ${color}aa)`
          }}>
            {emoji}
          </div>
        )}

        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: color,
          textShadow: `0 0 8px ${color}88`
        }}>
          Terminal Hub
        </div>

        <div style={{
          color: '#f1f5f9',
          fontWeight: 800,
          fontSize: '18px',
          letterSpacing: '-0.5px',
          textAlign: 'center',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          {name}
        </div>
      </div>
    </div>
  );
}

function Receptionist({ x, y, playerX, playerY }) {
  const distance = Math.hypot(x - playerX, y - playerY);
  const isNear = distance < 160;

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNear) {
      setDismissed(false);
    }
  }, [isNear]);

  const showBubble = isNear && !dismissed;

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      zIndex: y,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none'
    }}>
      {/* Premium Glass Talk Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.85 }}
            animate={{ opacity: 1, y: -25, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.85 }}
            style={{
              position: 'absolute',
              bottom: '75px',
              width: '320px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              padding: '20px',
              borderRadius: '16px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.2)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              fontSize: '13.5px',
              lineHeight: '1.5',
              textAlign: 'left',
              zIndex: 100,
              pointerEvents: 'auto'
            }}
          >
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setDismissed(true);
              }}
              style={{
                position: 'absolute',
                top: '6px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: '#94a3b8',
                zIndex: 10,
                padding: '4px'
              }}
            >
              &times;
            </button>
            <strong style={{ color: '#818cf8', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Guide Bot</strong>
            Welcome to the AI Campus! Walk around to explore, and approach any of the buildings to Plug In. Inside, you can create or join live coding/gaming challenges.
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '14px',
              height: '14px',
              background: 'rgba(15, 23, 42, 0.85)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holographic Projection Platform */}
      <div style={{
        width: '40px',
        height: '10px',
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.2)',
        border: '1.5px solid rgba(99, 102, 241, 0.6)',
        boxShadow: '0 0 15px rgba(99, 102, 241, 0.6), inset 0 0 5px rgba(99, 102, 241, 0.8)',
        marginBottom: '-2px',
        position: 'relative'
      }}>
        {/* Projection light beam */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          left: '5%',
          width: '90%',
          height: '40px',
          background: 'linear-gradient(to top, rgba(99, 102, 241, 0.25), transparent)',
          clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
          animation: 'pulse 2s infinite alternate'
        }} />
      </div>

      {/* Holographic Guide Character */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'holoIdle 2.5s ease-in-out infinite alternate',
        opacity: 0.85,
        filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.7))',
        transformOrigin: 'bottom center'
      }}>
        <style>{`
          @keyframes holoIdle {
            0% { transform: translateY(0) scale(1); }
            100% { transform: translateY(-4px) scale(1.02); }
          }
        `}</style>
        <div style={{ position: 'relative', width: '28px', height: '40px' }}>
          {/* Head */}
          <div style={{
            position: 'absolute', top: 0, left: '6px', width: '16px', height: '16px',
            backgroundColor: 'rgba(129, 140, 248, 0.7)', border: '1.5px solid #818cf8', borderRadius: '50%'
          }} />
          {/* Body */}
          <div style={{
            position: 'absolute', top: '16px', left: '2px', width: '24px', height: '24px',
            backgroundColor: 'rgba(99, 102, 241, 0.5)', border: '1.5px solid #6366f1', borderRadius: '4px'
          }} />
        </div>
      </div>
      <div style={{
        fontSize: '12px', marginTop: '6px', fontWeight: 'bold', color: '#818cf8',
        textShadow: '0 0 8px rgba(129, 140, 248, 0.8)',
        whiteSpace: 'nowrap'
      }}>
        AI Guide
      </div>
    </div>
  );
}

function Tree({ x, y }) {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -100%)',
      zIndex: y,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      animation: 'treeSway 4s ease-in-out infinite alternate',
      transformOrigin: 'bottom center',
      pointerEvents: 'none'
    }}>
      <style>{`
        @keyframes treeSway {
          0% { transform: translate(-50%, -100%) rotate(-2.5deg); }
          100% { transform: translate(-50%, -100%) rotate(2.5deg); }
        }
      `}</style>
      {/* Holographic Glowing Leaf Node */}
      <div style={{
        width: '42px',
        height: '42px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.85) 0%, rgba(5, 150, 105, 0.3) 100%)',
        borderRadius: '50% 50% 0 50%',
        transform: 'rotate(-45deg)',
        border: '1.5px solid rgba(16, 185, 129, 0.6)',
        boxShadow: '0 0 16px rgba(16, 185, 129, 0.45), inset 0 0 8px rgba(255,255,255,0.4)',
        zIndex: 2,
        position: 'relative',
        top: '6px'
      }} />
      {/* Trunk */}
      <div style={{
        width: '6px',
        height: '22px',
        background: 'linear-gradient(to bottom, rgba(129, 140, 248, 0.65), rgba(99, 102, 241, 0.2))',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        borderRadius: '3px',
        boxShadow: '0 0 8px rgba(99, 102, 241, 0.3)',
        zIndex: 1
      }} />
    </div>
  );
}

export default CampusWorld;