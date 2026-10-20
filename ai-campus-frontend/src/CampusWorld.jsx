import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerCharacter from './PlayerCharacter';
import voxelBg from './assets/voxel_world_2x.png';

// World virtual dimensions based on the 2x upscaled voxel art
const WORLD_WIDTH = 1986;
const WORLD_HEIGHT = 890;

// Key landmark coordinates on the floating islands diorama
const GAMING_LAB_POS = { x: 550, y: 390 };
const ROADMAP_LAB_POS = { x: 1530, y: 470 };
const SPAWN_POS = { x: 1040, y: 480 };

function CampusWorld({
  players = [],
  myPlayerId,
  heldKeys,
  sendMoveInput,
  onEnterBuilding,
  speakingPeerIds = [],
  remoteVideoStreams = {},
  myVideoStream = null,
  isMicOn = false,
  toggleMic = () => {},
  isVideoOn = false,
  toggleVideo = () => {}
}) {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const canvasRef = useRef(null);
  const playerOriginsRef = useRef({});
  const clickTargetRef = useRef(null);
  const clickIntervalRef = useRef(null);
  const myPlayerRef = useRef(SPAWN_POS);

  // Resize handler
  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stop automated click-move pathing
  const stopClickMove = useCallback(() => {
    clickTargetRef.current = null;
    if (clickIntervalRef.current) {
      clearInterval(clickIntervalRef.current);
      clickIntervalRef.current = null;
    }
  }, []);

  // Clean up click timer on unmount
  useEffect(() => {
    return () => {
      if (clickIntervalRef.current) clearInterval(clickIntervalRef.current);
    };
  }, []);

  // Map player coordinates between legacy backend (centered around 100, 100)
  // and diorama world coordinates (centered at SPAWN_POS: 1040, 480).
  const toWorldPlayer = useCallback((p) => {
    if (!p) return SPAWN_POS;
    const px = typeof p.x === 'number' ? p.x : 100;
    const py = typeof p.y === 'number' ? p.y : 100;

    // Determine initial spawn offset for this player
    if (!playerOriginsRef.current[p.id]) {
      // If spawned in legacy coordinates (near 100, 100)
      if (Math.abs(px - 100) < 250 && Math.abs(py - 100) < 250) {
        playerOriginsRef.current[p.id] = {
          dx: SPAWN_POS.x - 100,
          dy: SPAWN_POS.y - 100,
        };
      } else {
        playerOriginsRef.current[p.id] = { dx: 0, dy: 0 };
      }
    }

    const { dx, dy } = playerOriginsRef.current[p.id];
    return {
      ...p,
      x: px + dx,
      y: py + dy,
    };
  }, []);

  // Clean up origins for disconnected players
  useEffect(() => {
    const activeIds = new Set(players.map((p) => p.id));
    for (const id in playerOriginsRef.current) {
      if (!activeIds.has(id)) {
        delete playerOriginsRef.current[id];
      }
    }
  }, [players]);

  // Find my player mapped to world space
  const rawMyPlayer = players.find((p) => p.id === myPlayerId);
  const myPlayer = useMemo(() => {
    return toWorldPlayer(rawMyPlayer);
  }, [rawMyPlayer, toWorldPlayer]);

  useEffect(() => {
    myPlayerRef.current = myPlayer;
  }, [myPlayer]);

  // Viewport scale & offset calculation
  // Keeps the floating island diorama perfectly framed and centered
  const scale = useMemo(() => {
    return Math.max(0.85, Math.min(1.2, viewport.w / WORLD_WIDTH));
  }, [viewport.w]);

  // Center camera on player with smooth bounds clamping
  const scaledWorldW = WORLD_WIDTH * scale;
  const scaledWorldH = WORLD_HEIGHT * scale;

  let targetOffsetX = viewport.w / 2 - myPlayer.x * scale;
  let targetOffsetY = viewport.h / 2 - myPlayer.y * scale;

  // If the world is smaller than viewport, center it
  if (scaledWorldW <= viewport.w) {
    targetOffsetX = (viewport.w - scaledWorldW) / 2;
  } else {
    targetOffsetX = Math.min(0, Math.max(viewport.w - scaledWorldW, targetOffsetX));
  }

  if (scaledWorldH <= viewport.h) {
    targetOffsetY = (viewport.h - scaledWorldH) / 2;
  } else {
    targetOffsetY = Math.min(0, Math.max(viewport.h - scaledWorldH, targetOffsetY));
  }

  // Distance checks for interactive terminals
  const distToGaming = Math.hypot(myPlayer.x - GAMING_LAB_POS.x, myPlayer.y - GAMING_LAB_POS.y);
  const distToRoadmap = Math.hypot(myPlayer.x - ROADMAP_LAB_POS.x, myPlayer.y - ROADMAP_LAB_POS.y);
  const isNearGaming = distToGaming < 260;
  const isNearRoadmap = distToRoadmap < 260;

  // Keyboard shortcut to enter building when near & cancel click-move on key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cancel click-move whenever a movement key or action is pressed
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        stopClickMove();
      }
      if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        if (isNearGaming) {
          onEnterBuilding('gaminglab', 'Gaming Lab');
        } else if (isNearRoadmap) {
          onEnterBuilding('roadmaplab', 'Roadmap Lab');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNearGaming, isNearRoadmap, onEnterBuilding, stopClickMove]);

  // Ambient Floating Sparks / Particle Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      size: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.45 + 0.15,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.7 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      color: Math.random() > 0.5 ? '#c084fc' : Math.random() > 0.3 ? '#22d3ee' : '#fde047'
    }));

    const render = () => {
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.opacity += Math.sin(Date.now() * p.pulseSpeed) * 0.01;

        if (p.y < 0) {
          p.y = WORLD_HEIGHT;
          p.x = Math.random() * WORLD_WIDTH;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = Math.max(0.1, Math.min(0.9, p.opacity));
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Click-to-move support on the world plane
  const handleWorldClick = useCallback((e) => {
    if (e.target.closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;

    clickTargetRef.current = { x: clickX, y: clickY };

    if (clickIntervalRef.current) clearInterval(clickIntervalRef.current);

    const step = () => {
      const target = clickTargetRef.current;
      if (!target) return;
      const current = myPlayerRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 24) {
        stopClickMove();
        heldKeys.current.right = false;
        heldKeys.current.left = false;
        heldKeys.current.down = false;
        heldKeys.current.up = false;
        sendMoveInput();
        return;
      }

      heldKeys.current.right = dx > 15;
      heldKeys.current.left = dx < -15;
      heldKeys.current.down = dy > 15;
      heldKeys.current.up = dy < -15;
      sendMoveInput();
    };

    step();
    clickIntervalRef.current = setInterval(step, 80);
  }, [scale, sendMoveInput, stopClickMove, heldKeys]);

  // D-pad button builder
  const btnBase = {
    width: '42px',
    height: '42px',
    fontSize: '15px',
    cursor: 'pointer',
    background: 'rgba(15, 23, 42, 0.75)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#94a3b8',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    userSelect: 'none',
    outline: 'none'
  };

  const makeBtn = (key, label) => ({
    type: 'button',
    onMouseDown:  () => { stopClickMove(); heldKeys.current[key] = true;  sendMoveInput(); },
    onMouseUp:    () => { heldKeys.current[key] = false; sendMoveInput(); },
    onMouseLeave: () => { heldKeys.current[key] = false; sendMoveInput(); },
    onTouchStart: (e) => { e.preventDefault(); stopClickMove(); heldKeys.current[key] = true;  sendMoveInput(); },
    onTouchEnd:   () => { heldKeys.current[key] = false; sendMoveInput(); },
    onTouchCancel: () => { heldKeys.current[key] = false; sendMoveInput(); },
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
      backgroundColor: '#04060e',
      backgroundImage: `
        radial-gradient(ellipse at 50% 40%, rgba(88, 28, 135, 0.15) 0%, transparent 70%),
        radial-gradient(circle at 80% 30%, rgba(14, 165, 233, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 20% 70%, rgba(147, 51, 234, 0.1) 0%, transparent 60%)
      `,
    }}>

      {/* Floating Video & Mic Controls (Top Left under Nav Bar) */}
      <div style={{
        position: 'fixed',
        top: '74px',
        left: '28px',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'auto'
      }}>
        {/* Video Toggle Button */}
        <button
          onClick={toggleVideo}
          title={isVideoOn ? "Turn camera off" : "Turn camera on"}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: isVideoOn ? 'rgba(59, 130, 246, 0.25)' : 'rgba(15, 23, 42, 0.75)',
            border: isVideoOn ? '2px solid #38bdf8' : '1.5px solid rgba(168, 85, 247, 0.5)',
            boxShadow: isVideoOn
              ? '0 0 18px rgba(56, 189, 248, 0.7), inset 0 0 10px rgba(56, 189, 248, 0.4)'
              : '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(168, 85, 247, 0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            color: '#ffffff',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.borderColor = '#c084fc';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(192, 132, 252, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = isVideoOn ? '#38bdf8' : 'rgba(168, 85, 247, 0.5)';
            e.currentTarget.style.boxShadow = isVideoOn
              ? '0 0 18px rgba(56, 189, 248, 0.7)'
              : '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(168, 85, 247, 0.3)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>

        {/* Microphone Toggle Button */}
        <button
          onClick={toggleMic}
          title={isMicOn ? "Turn microphone off" : "Turn microphone on"}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: isMicOn ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.75)',
            border: isMicOn ? '2px solid #34d399' : '1.5px solid rgba(168, 85, 247, 0.5)',
            boxShadow: isMicOn
              ? '0 0 18px rgba(52, 211, 153, 0.7), inset 0 0 10px rgba(52, 211, 153, 0.4)'
              : '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(168, 85, 247, 0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            color: '#ffffff',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.borderColor = '#c084fc';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(192, 132, 252, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = isMicOn ? '#34d399' : 'rgba(168, 85, 247, 0.5)';
            e.currentTarget.style.boxShadow = isMicOn
              ? '0 0 18px rgba(52, 211, 153, 0.7)'
              : '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(168, 85, 247, 0.3)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>

      {/* Main Diorama World Plane */}
      <div
        onClick={handleWorldClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${WORLD_WIDTH}px`,
          height: `${WORLD_HEIGHT}px`,
          transformOrigin: '0 0',
          transform: `translate(${targetOffsetX}px, ${targetOffsetY}px) scale(${scale})`,
          transition: 'transform 0.12s linear',
          backgroundImage: `url(${voxelBg})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          imageRendering: 'auto',
          cursor: 'crosshair',
        }}
      >
        {/* Ambient Cosmic Particles Canvas */}
        <canvas
          ref={canvasRef}
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />

        {/* ── Left Island: Gaming Lab Proximity Prompt & Platform Pulse ── */}
        <div style={{
          position: 'absolute',
          left: GAMING_LAB_POS.x,
          top: GAMING_LAB_POS.y,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 40
        }}>
          {/* Subtle Dais Energy Ring on Platform Floor (Pulses gently) */}
          <div style={{
            position: 'absolute',
            bottom: '-40px',
            width: '140px',
            height: '46px',
            borderRadius: '50%',
            border: isNearGaming ? '2px solid rgba(192, 132, 252, 0.9)' : '1.5px solid rgba(168, 85, 247, 0.4)',
            boxShadow: isNearGaming
              ? '0 0 30px rgba(168, 85, 247, 0.95), inset 0 0 20px rgba(168, 85, 247, 0.6)'
              : '0 0 15px rgba(168, 85, 247, 0.4)',
            animation: 'pulseDais 2.5s ease-in-out infinite alternate',
            transition: 'all 0.3s ease',
            zIndex: 2
          }} />

          {/* Interactive Proximity Action Prompt */}
          <AnimatePresence>
            {isNearGaming && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: -70, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'absolute',
                  zIndex: 100,
                  pointerEvents: 'auto'
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterBuilding('gaminglab', 'Gaming Lab');
                  }}
                  style={{
                    padding: '11px 26px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    backgroundColor: '#ffffff',
                    color: '#4c1d95',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 30px rgba(192, 132, 252, 0.85)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                    e.currentTarget.style.boxShadow = '0 12px 35px rgba(0,0,0,0.8), 0 0 38px rgba(255,255,255,0.95)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7), 0 0 30px rgba(192, 132, 252, 0.85)';
                  }}
                >
                  <span style={{ fontSize: '16px' }}>⚡</span> Enter Gaming Lab
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right Island: Roadmap Lab Proximity Prompt & Platform Pulse ── */}
        <div style={{
          position: 'absolute',
          left: ROADMAP_LAB_POS.x,
          top: ROADMAP_LAB_POS.y,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 40
        }}>
          {/* Subtle Dais Energy Ring on Platform Floor (Pulses gently) */}
          <div style={{
            position: 'absolute',
            bottom: '-40px',
            width: '140px',
            height: '46px',
            borderRadius: '50%',
            border: isNearRoadmap ? '2px solid rgba(34, 211, 238, 0.9)' : '1.5px solid rgba(6, 182, 212, 0.4)',
            boxShadow: isNearRoadmap
              ? '0 0 30px rgba(34, 211, 238, 0.95), inset 0 0 20px rgba(34, 211, 238, 0.6)'
              : '0 0 15px rgba(34, 211, 238, 0.4)',
            animation: 'pulseDaisCyan 2.5s ease-in-out infinite alternate',
            transition: 'all 0.3s ease',
            zIndex: 2
          }} />

          {/* Interactive Proximity Action Prompt */}
          <AnimatePresence>
            {isNearRoadmap && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: -70, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'absolute',
                  zIndex: 100,
                  pointerEvents: 'auto'
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterBuilding('roadmaplab', 'Roadmap Lab');
                  }}
                  style={{
                    padding: '11px 26px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    letterSpacing: '0.4px',
                    backgroundColor: '#ffffff',
                    color: '#0e7490',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 30px rgba(34, 211, 238, 0.85)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                    e.currentTarget.style.boxShadow = '0 12px 35px rgba(0,0,0,0.8), 0 0 38px rgba(255,255,255,0.95)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7), 0 0 30px rgba(34, 211, 238, 0.85)';
                  }}
                >
                  <span style={{ fontSize: '16px' }}>⚡</span> Enter Roadmap Lab
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Central Circular Hub & Portal Floor Ring ── */}
        <div style={{
          position: 'absolute',
          left: SPAWN_POS.x,
          top: SPAWN_POS.y,
          transform: 'translate(-50%, -50%)',
          width: '74px',
          height: '32px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.4) 0%, rgba(6, 182, 212, 0.15) 60%, transparent 80%)',
          border: '2px solid rgba(56, 189, 248, 0.85)',
          boxShadow: '0 0 25px rgba(56, 189, 248, 0.9), inset 0 0 12px rgba(56, 189, 248, 0.6)',
          animation: 'centralPortalPulse 2s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 5
        }}>
          {/* Concentric Energy Aura Wave */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: '-6px',
            right: '-6px',
            bottom: '-6px',
            borderRadius: '50%',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            animation: 'waveExpand 3s linear infinite',
            pointerEvents: 'none'
          }} />
        </div>

        {/* ── Render Multiplayer Characters ── */}
        {players.map((p) => {
          const effectivePlayer = toWorldPlayer(p);
          return (
            <PlayerCharacter
              key={p.id}
              player={effectivePlayer}
              isMe={p.id === myPlayerId}
              isSpeaking={speakingPeerIds.includes(p.id)}
              videoStream={p.id === myPlayerId ? myVideoStream : remoteVideoStreams[p.id]}
            />
          );
        })}
      </div>

      {/* ── On-Screen Directional D-pad Movement HUD (Bottom-Right) ── */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(8, 12, 22, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '12px 14px 10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)'
      }}>
        {/* Up row */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            {...makeBtn('up', '↑')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = btnBase.background; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
        </div>
        {/* Middle row: left, down, right */}
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button
            {...makeBtn('left', '←')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = btnBase.background; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
          <button
            {...makeBtn('down', '↓')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = btnBase.background; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
          <button
            {...makeBtn('right', '→')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = btnBase.background; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          />
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '9px', marginTop: '4px', letterSpacing: '0.8px', textTransform: 'uppercase', fontWeight: 600 }}>
          WASD OR CLICK
        </p>
      </div>

      <style>{`
        @keyframes pulseDais {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes pulseDaisCyan {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes centralPortalPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; box-shadow: 0 0 20px rgba(56, 189, 248, 0.8); }
          100% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; box-shadow: 0 0 30px rgba(56, 189, 248, 1); }
        }
        @keyframes waveExpand {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CampusWorld;