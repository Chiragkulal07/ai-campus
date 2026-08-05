import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerCharacter from './PlayerCharacter';

function CampusWorld({ labs = [], players, myPlayerId, heldKeys, sendMoveInput, onEnterBuilding, speakingPeerIds = [] }) {
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
    width: '48px', height: '48px', fontSize: '18px',
    cursor: 'pointer',
    background: 'rgba(8,12,20,0.75)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    color: 'white',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.1s',
    userSelect: 'none',
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
      backgroundColor: '#7ec850',
      backgroundImage: `
        linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0.15)),
        linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0.15))
      `,
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0, 20px 20px',
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
        <Tree x={1200} y={800} />

        {/* Buildings dynamically generated from backend labs list */}
        {labs.map(lab => (
          <Building
            key={lab.id}
            id={lab.id}
            x={lab.mapConfig.x}
            y={lab.mapConfig.y}
            name={lab.name}
            color={lab.mapConfig.color}
            playerX={myPlayer.x}
            playerY={myPlayer.y}
            onEnter={onEnterBuilding}
          />
        ))}

        {/* Players */}
        {players.map((p) => (
          <PlayerCharacter
            key={p.id}
            player={p}
            isMe={p.id === myPlayerId}
            isSpeaking={speakingPeerIds.includes(p.id)}
          />
        ))}
      </div>

      {/* Movement HUD */}
      <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
          <button {...makeBtn('up', '↑')} />
        </div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button {...makeBtn('left', '←')} />
          <button {...makeBtn('down', '↓')} />
          <button {...makeBtn('right', '→')} />
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '6px', fontFamily: "'Inter',sans-serif" }}>
          Arrow keys or buttons
        </p>
      </div>
    </div>
  );
}

function Building({ id, x, y, name, color, playerX, playerY, onEnter }) {
  const distance = Math.hypot(x - playerX, y - playerY);
  const isNear = distance < 150;

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      width: '240px',
      height: '180px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 10
    }}>
      {/* Floating Prompt */}
      <AnimatePresence>
        {isNear && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            style={{
              position: 'absolute',
              top: '-40px',
              zIndex: 20
            }}
          >
            <button
              onClick={() => onEnter(id, name)}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#ffffff',
                color: '#333',
                border: '3px solid #333',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
                whiteSpace: 'nowrap',
                pointerEvents: 'auto'
              }}
            >
              Enter {name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roof */}
      <div style={{
        width: '0',
        height: '0',
        borderLeft: '130px solid transparent',
        borderRight: '130px solid transparent',
        borderBottom: `70px solid ${color}`,
        filter: 'brightness(0.85)',
        marginBottom: '-2px'
      }} />
      {/* Main Building */}
      <div style={{
        width: '260px',
        height: '110px',
        backgroundColor: color,
        borderRadius: '0 0 16px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 20px 30px rgba(0,0,0,0.3)',
        border: '6px solid rgba(0,0,0,0.15)',
        borderTop: 'none'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px 20px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '18px',
          color: '#222',
          boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {name}
        </div>
      </div>
    </div>
  );
}

export default CampusWorld;

function Receptionist({ x, y, playerX, playerY }) {
  const distance = Math.hypot(x - playerX, y - playerY);
  const isNear = distance < 150;

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
      alignItems: 'center'
    }}>
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            style={{
              position: 'absolute',
              bottom: '60px',
              width: '280px',
              backgroundColor: '#ffffff',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              border: '2px solid #ddd',
              color: '#333',
              fontSize: '14px',
              lineHeight: '1.4',
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
                top: '4px',
                right: '8px',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: '#888',
                zIndex: 10,
                padding: '4px'
              }}
            >
              &times;
            </button>
            Welcome to AI Campus! I'm here to help. Walk around to explore, and get close to any of the 4 buildings to see an Enter option. Inside, you can create or join live challenges with other players. Good luck!
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '14px',
              height: '14px',
              backgroundColor: '#ffffff',
              borderBottom: '2px solid #ddd',
              borderRight: '2px solid #ddd',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transformOrigin: 'bottom center',
          animation: 'blockyIdle 0.8s steps(2, end) infinite alternate'
        }}
      >
        <div style={{ position: 'relative', width: '32px', height: '48px' }}>
          <div style={{
            position: 'absolute', top: '20px', left: '12px', width: '8px', height: '14px',
            backgroundColor: '#d8b080', border: '2px solid #333', borderRadius: '2px', zIndex: 0,
          }} />
          <div style={{
            position: 'absolute', top: '34px', left: '6px', width: '8px', height: '14px',
            backgroundColor: '#4a4a4a', border: '2px solid #333', borderRadius: '2px', zIndex: 0,
          }} />
          <div style={{
            position: 'absolute', top: '20px', left: '4px', width: '24px', height: '16px',
            backgroundColor: '#f5deb3', border: '2px solid #333', borderRadius: '2px', zIndex: 1,
          }} />
          <div style={{
            position: 'absolute', top: 0, left: '6px', width: '20px', height: '20px',
            backgroundColor: '#ffdbac', border: '2px solid #333', borderRadius: '2px', zIndex: 2,
          }}>
            <div style={{ position: 'absolute', top: '6px', left: '3px', width: '4px', height: '4px', backgroundColor: '#000' }} />
            <div style={{ position: 'absolute', top: '6px', right: '3px', width: '4px', height: '4px', backgroundColor: '#000' }} />
          </div>
          <div style={{
            position: 'absolute', top: '34px', left: '16px', width: '8px', height: '14px',
            backgroundColor: '#5a5a5a', border: '2px solid #333', borderRadius: '2px', zIndex: 1,
          }} />
          <div style={{
            position: 'absolute', top: '20px', left: '12px', width: '8px', height: '14px',
            backgroundColor: '#ffdbac', border: '2px solid #333', borderRadius: '2px', zIndex: 3,
          }} />
        </div>
      </div>
      <div style={{
        fontSize: '13px', marginTop: '6px', fontWeight: 'bold', color: 'white',
        textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black',
        whiteSpace: 'nowrap'
      }}>
        Receptionist
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
      transformOrigin: 'bottom center'
    }}>
      <style>{`
        @keyframes treeSway {
          0% { transform: translate(-50%, -100%) rotate(-4deg); }
          100% { transform: translate(-50%, -100%) rotate(4deg); }
        }
      `}</style>
      <div style={{
        width: '70px', height: '70px', backgroundColor: '#2e8c3a', borderRadius: '50%',
        boxShadow: 'inset -8px -8px 0px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.3)',
        zIndex: 2, position: 'relative', top: '15px'
      }} />
      <div style={{
        width: '14px', height: '35px', backgroundColor: '#5c4033', borderRadius: '3px',
        boxShadow: 'inset -3px 0 0 rgba(0,0,0,0.2)', zIndex: 1
      }} />
    </div>
  );
}