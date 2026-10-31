import { useEffect } from 'react';

// Elements that get a cursor-following spotlight.
const SPOTLIGHT = '.card, .list-row, .stat-grid, .lp-card, .resource-card, .roadmap-form-card, .lobby-card';

// One document-level pointer listener drives two effects via CSS variables:
//  • spotlight: --mx / --my (cursor position inside the element)
//  • tilt:      --rx / --ry on elements marked data-fx="tilt"
export default function useFx() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (window.matchMedia?.('(hover: none)').matches) return undefined;

    let frame = 0;
    let lastEvent = null;

    const apply = () => {
      frame = 0;
      const e = lastEvent;
      if (!e || !(e.target instanceof Element)) return;

      const spot = e.target.closest(SPOTLIGHT);
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--my', `${e.clientY - r.top}px`);
      }

      const tilt = e.target.closest('[data-fx="tilt"]');
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
      }
    };

    const onMove = (e) => {
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onOut = (e) => {
      if (!(e.target instanceof Element)) return;
      const tilt = e.target.closest('[data-fx="tilt"]');
      if (tilt && !(e.relatedTarget instanceof Node && tilt.contains(e.relatedTarget))) {
        tilt.style.setProperty('--rx', '0deg');
        tilt.style.setProperty('--ry', '0deg');
      }
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
