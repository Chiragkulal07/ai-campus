import { motion, AnimatePresence } from 'framer-motion';
import './campus.css';

// Gaming Lab emblem: rotating targeting ring with a pulsing core.
function CrosshairMotif() {
  return (
    <svg className="lp-motif lp-motif-crosshair" viewBox="0 0 40 40" aria-hidden="true">
      <circle className="lp-ch-ring" cx="20" cy="20" r="15" />
      <circle className="lp-ch-inner" cx="20" cy="20" r="8" />
      <path className="lp-ch-ticks" d="M20 2v7M20 31v7M2 20h7M31 20h7" />
      <circle className="lp-ch-core" cx="20" cy="20" r="2.4" />
    </svg>
  );
}

// Roadmap Lab emblem: a path that draws itself through three milestones.
function PathMotif() {
  return (
    <svg className="lp-motif lp-motif-path" viewBox="0 0 40 40" aria-hidden="true">
      <path className="lp-path-track" d="M6 30 C 14 30, 12 12, 20 12 S 28 26, 34 10" />
      <path className="lp-path-line" d="M6 30 C 14 30, 12 12, 20 12 S 28 26, 34 10" pathLength="100" />
      <circle className="lp-path-node" style={{ '--n': 0 }} cx="6" cy="30" r="3" />
      <circle className="lp-path-node" style={{ '--n': 1 }} cx="20" cy="12" r="3" />
      <circle className="lp-path-node" style={{ '--n': 2 }} cx="34" cy="10" r="3" />
    </svg>
  );
}

const LABS = {
  gaminglab: {
    title: 'Gaming Lab',
    kicker: 'Arena',
    desc: 'Real-time multiplayer matches',
    rgb: '251, 146, 60',
    Motif: CrosshairMotif,
  },
  roadmaplab: {
    title: 'Roadmap Lab',
    kicker: 'Learning paths',
    desc: 'Build a step-by-step plan for any topic',
    rgb: '94, 234, 212',
    Motif: PathMotif,
  },
};

const MOTES = Array.from({ length: 9 }, (_, i) => i);

function LabPortal({
  lab, x, y, active, onEnter,
  prox = 0, metres = 0, hovered = false, travelling = false, onHover = () => {}, onTravel = () => {},
}) {
  const cfg = LABS[lab];
  const { Motif } = cfg;
  const RING_C = 2 * Math.PI * 13; // circumference of the beacon progress ring

  return (
    <div
      className={`lp-root ${active ? 'is-active' : ''} ${hovered ? 'is-hovered' : ''} ${travelling ? 'is-travelling' : ''}`}
      style={{ left: x, top: y, '--lp-rgb': cfg.rgb, '--prox': prox.toFixed(3) }}
    >
      {/* Invisible hotspot over the building: hover to preview, click to walk there
          (or enter, once in range). Always mounted so mouse-leave always fires. */}
      <div
        className="lp-hotspot"
        role="button"
        tabIndex={-1}
        aria-label={active ? `Enter ${cfg.title}` : `Walk to ${cfg.title}`}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={(e) => { e.stopPropagation(); if (active) onEnter(); else onTravel(); }}
      />

      {/* Soft ground glow that grows as the player gets closer */}
      <div className="lp-glow" />

      {/* Floor rig: always visible, intensifies when the player is near */}
      <div className="lp-floor">
        <div className="lp-floor-plane">
          <div className="lp-ring lp-ring-outer" />
          <div className="lp-ring lp-ring-inner" />
          <div className="lp-wave" style={{ '--w': 0 }} />
          <div className="lp-wave" style={{ '--w': 1 }} />
          <div className="lp-wave" style={{ '--w': 2 }} />
        </div>
        <div className="lp-motes">
          {MOTES.map((i) => <span key={i} style={{ '--m': i }} />)}
        </div>
      </div>

      {/* Distance beacon — visible while the player is away */}
      <div className="lp-beacon-anchor">
        <AnimatePresence onExitComplete={() => onHover(false)}>
          {!active && (
            <motion.button
              type="button"
              className="lp-beacon"
              initial={{ opacity: 0, y: -6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onMouseEnter={() => onHover(true)}
              onMouseLeave={() => onHover(false)}
              onFocus={() => onHover(true)}
              onBlur={() => onHover(false)}
              onClick={(e) => { e.stopPropagation(); onTravel(); }}
              aria-label={`${cfg.title}, ${metres} metres away. Walk there`}
            >
              <span className="lp-beacon-ring" aria-hidden="true">
                <svg viewBox="0 0 32 32">
                  <circle className="lp-beacon-track" cx="16" cy="16" r="13" />
                  <circle
                    className="lp-beacon-fill"
                    cx="16" cy="16" r="13"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - prox)}
                  />
                </svg>
                <span className="lp-beacon-dot" />
              </span>
              <span className="lp-beacon-text">
                <span className="lp-beacon-name">{cfg.title}</span>
                <span className="lp-beacon-meta">
                  {travelling ? 'On the way…' : `${metres} m away`}
                </span>
              </span>
              <span className="lp-beacon-cta" aria-hidden="true">
                Walk here
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Light beam connecting the floor to the card */}
      <div className="lp-beam" />

      {/* Anchor does the centering so framer-motion's transform on the card doesn't override it */}
      <div className="lp-card-anchor">
      <AnimatePresence>
        {active && (
          <motion.div
            className="lp-card"
            role="dialog"
            aria-label={cfg.title}
            initial={{ opacity: 0, y: 22, scale: 0.88, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, scale: 0.94, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="lp-corner lp-c-tl" />
            <span className="lp-corner lp-c-tr" />
            <span className="lp-corner lp-c-bl" />
            <span className="lp-corner lp-c-br" />
            <span className="lp-scan" />

            <div className="lp-head">
              <div className="lp-emblem"><Motif /></div>
              <div className="lp-head-text">
                <div className="lp-kicker">{cfg.kicker}</div>
                <div className="lp-title">{cfg.title}</div>
              </div>
            </div>
            <p className="lp-desc">{cfg.desc}</p>

            <div className="lp-actions">
              <button
                type="button"
                className="lp-enter"
                onClick={(e) => { e.stopPropagation(); onEnter(); }}
              >
                <span>Enter</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
              <span className="lp-hint">or press <kbd>E</kbd></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default LabPortal;
