import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import PlayerCharacter from './PlayerCharacter';
import LabPortal from './LabPortal';
import MediaDock from './MediaDock';
import voxelBg from './assets/voxel_world_2x.png';

// World virtual dimensions based on the 2x upscaled voxel art
const WORLD_WIDTH = 1986;
const WORLD_HEIGHT = 890;

// Key landmark coordinates on the floating islands diorama
const GAMING_LAB_POS = { x: 550, y: 390 };
const ROADMAP_LAB_POS = { x: 1530, y: 470 };
const SPAWN_POS = { x: 1040, y: 480 };

const ENTER_RADIUS = 260;          // distance at which a lab's entry card appears
const AWARE_RANGE = 900;           // beyond ENTER_RADIUS + this, a lab is at minimum glow
const LAB_RGB = { gaminglab: '251, 146, 60', roadmaplab: '94, 234, 212' };
const LAB_POS = { gaminglab: GAMING_LAB_POS, roadmaplab: ROADMAP_LAB_POS };

// 0 when far away, 1 at the entry radius — drives the gradual glow.
const proximity = (dist) => Math.max(0, Math.min(1, 1 - (dist - ENTER_RADIUS) / AWARE_RANGE));
// Friendly distance to the entry point, in "metres".
const metresAway = (dist) => Math.max(0, Math.round((dist - ENTER_RADIUS) / 12));

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
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const playerOriginsRef = useRef({});
  const clickTargetRef = useRef(null);
  const clickIntervalRef = useRef(null);
  const myPlayerRef = useRef(SPAWN_POS);

  // Track the container size (the area below the app header), so the camera
  // centers the player in the visible area rather than the whole window.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setViewport((v) => (v.w === width && v.h === height ? v : { w: width, h: height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [hoveredLab, setHoveredLab] = useState(null); // lab being previewed (hover)
  const [travelLab, setTravelLab] = useState(null);   // lab we are auto-walking to

  // Stop automated click-move pathing
  const stopClickMove = useCallback(() => {
    clickTargetRef.current = null;
    setTravelLab(null);
    if (clickIntervalRef.current) {
      clearInterval(clickIntervalRef.current);
      clickIntervalRef.current = null;
    }
  }, []);

  // Clean up click timer on unmount and release any keys it was holding
  useEffect(() => {
    return () => {
      if (clickIntervalRef.current) {
        clearInterval(clickIntervalRef.current);
        clickIntervalRef.current = null;
        heldKeys.current = { up: false, down: false, left: false, right: false };
        sendMoveInput();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isNearGaming = distToGaming < ENTER_RADIUS;
  const isNearRoadmap = distToRoadmap < ENTER_RADIUS;

  // Keyboard shortcut to enter building when near & cancel click-move on key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cancel click-move whenever a movement key or action is pressed
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        stopClickMove();
      }
      if (e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
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

  // Walk the player toward a world-space target by simulating held keys.
  const walkTo = useCallback((target, { stopRadius = 24, labId = null } = {}) => {
    clickTargetRef.current = target;
    setTravelLab(labId);
    if (clickIntervalRef.current) clearInterval(clickIntervalRef.current);

    const step = () => {
      const t = clickTargetRef.current;
      if (!t) return;
      const current = myPlayerRef.current;
      const dx = t.x - current.x;
      const dy = t.y - current.y;
      const dist = Math.hypot(dx, dy);

      if (dist < stopRadius) {
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
  }, [sendMoveInput, stopClickMove, heldKeys]);

  // Click-to-move support on the world plane
  const handleWorldClick = useCallback((e) => {
    if (e.target.closest('button, .lp-hotspot')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    walkTo({ x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale });
  }, [scale, walkTo]);

  // Walk to a lab's entrance; stops once inside its entry radius.
  const travelToLab = useCallback((labId) => {
    const pos = LAB_POS[labId];
    setHoveredLab(null);
    walkTo({ x: pos.x, y: pos.y + 18 }, { stopRadius: 120, labId });
  }, [walkTo]);

  // D-pad button builder
  const makeBtn = (key, label) => ({
    type: 'button',
    className: 'campus-dpad-btn',
    'aria-label': `Move ${key}`,
    onMouseDown:  () => { stopClickMove(); heldKeys.current[key] = true;  sendMoveInput(); },
    onMouseUp:    () => { heldKeys.current[key] = false; sendMoveInput(); },
    onMouseLeave: () => { heldKeys.current[key] = false; sendMoveInput(); },
    onTouchStart: (e) => { e.preventDefault(); stopClickMove(); heldKeys.current[key] = true;  sendMoveInput(); },
    onTouchEnd:   () => { heldKeys.current[key] = false; sendMoveInput(); },
    onTouchCancel: () => { heldKeys.current[key] = false; sendMoveInput(); },
    children: label,
  });

  return (
    <div ref={containerRef} style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      zIndex: 0,
      backgroundColor: '#04060e',
      backgroundImage: `
        radial-gradient(ellipse at 50% 40%, rgba(88, 28, 135, 0.15) 0%, transparent 70%),
        radial-gradient(circle at 80% 30%, rgba(14, 165, 233, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 20% 70%, rgba(147, 51, 234, 0.1) 0%, transparent 60%)
      `,
    }}>


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

        {/* ── Lab portals: floor rig + holographic card when the player is near ── */}
        {/* Guide route: previews the way to a hovered lab, and shows it while travelling */}
        {(() => {
          const routeLab = travelLab || hoveredLab;
          if (!routeLab) return null;
          const near = routeLab === 'gaminglab' ? isNearGaming : isNearRoadmap;
          if (near) return null;
          const to = LAB_POS[routeLab];
          const fx = myPlayer.x, fy = myPlayer.y + 10;
          const tx = to.x, ty = to.y + 18;
          const cx = (fx + tx) / 2, cy = Math.min(fy, ty) - Math.abs(tx - fx) * 0.12 - 30;
          const d = `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
          return (
            <svg
              className={`campus-route ${travelLab ? 'is-travelling' : ''}`}
              style={{ '--lp-rgb': LAB_RGB[routeLab] }}
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT}
              viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
              aria-hidden="true"
            >
              <path className="campus-route-glow" d={d} />
              <path className="campus-route-line" d={d} />
              <circle className="campus-route-comet" r="4">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={d} />
              </circle>
              <circle className="campus-route-end" cx={tx} cy={ty} r="7" />
            </svg>
          );
        })()}

        <LabPortal
          lab="gaminglab"
          x={GAMING_LAB_POS.x}
          y={GAMING_LAB_POS.y}
          active={isNearGaming}
          prox={proximity(distToGaming)}
          metres={metresAway(distToGaming)}
          hovered={hoveredLab === 'gaminglab'}
          travelling={travelLab === 'gaminglab'}
          onHover={(on) => setHoveredLab(on ? 'gaminglab' : null)}
          onTravel={() => travelToLab('gaminglab')}
          onEnter={() => onEnterBuilding('gaminglab', 'Gaming Lab')}
        />
        <LabPortal
          lab="roadmaplab"
          x={ROADMAP_LAB_POS.x}
          y={ROADMAP_LAB_POS.y}
          active={isNearRoadmap && !isNearGaming}
          prox={proximity(distToRoadmap)}
          metres={metresAway(distToRoadmap)}
          hovered={hoveredLab === 'roadmaplab'}
          travelling={travelLab === 'roadmaplab'}
          onHover={(on) => setHoveredLab(on ? 'roadmaplab' : null)}
          onTravel={() => travelToLab('roadmaplab')}
          onEnter={() => onEnterBuilding('roadmaplab', 'Roadmap Lab')}
        />

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

        {/* ── Mic & camera dock, just under MY character's feet ── */}
        {myPlayerId && (
          <MediaDock
            x={myPlayer.x}
            y={myPlayer.y + 24}
            isMicOn={isMicOn}
            isVideoOn={isVideoOn}
            toggleMic={toggleMic}
            toggleVideo={toggleVideo}
          />
        )}
      </div>

      {/* ── On-Screen Directional D-pad Movement HUD (Bottom-Right) ── */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(14, 19, 29, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 10px 8px',
        boxShadow: 'var(--shadow)'
      }}>
        {/* Up row */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            {...makeBtn('up', '↑')}
          />
        </div>
        {/* Middle row: left, down, right */}
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button
            {...makeBtn('left', '←')}
          />
          <button
            {...makeBtn('down', '↓')}
          />
          <button
            {...makeBtn('right', '→')}
          />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px', fontWeight: 500 }}>
          WASD or click to move
        </p>
      </div>

      <style>{`
        .campus-dpad-btn {
          width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-muted);
          user-select: none;
          touch-action: none;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .campus-dpad-btn:hover { background: var(--surface-3); color: var(--text-strong); border-color: var(--border-hover); }
        .campus-dpad-btn:active { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-border); }
        .campus-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 5px; margin: 0 3px;
          border-radius: 5px; border: 1px solid var(--border-strong);
          background: var(--surface-3); color: var(--text-strong);
          font-family: var(--font-mono); font-size: 11px; font-weight: 600;
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