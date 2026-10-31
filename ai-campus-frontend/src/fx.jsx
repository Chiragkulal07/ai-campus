import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Animates a number from its previous value to the new one (ease-out).
// Non-numeric values (e.g. "–") are rendered as-is.
export function CountUp({ value, decimals = 0, duration = 1100 }) {
  const target = Number(value);
  const isNumber = value !== null && value !== '' && Number.isFinite(target);
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isNumber) return undefined;
    const from = fromRef.current;
    const total = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = total === 0 ? 1 : Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, isNumber, duration]);

  if (!isNumber) return <>{value}</>;
  return <span className="count-up">{display.toFixed(decimals)}</span>;
}

// Reveals a heading word by word, each rising out of a mask.
export function SplitWords({ text, delay = 0 }) {
  const words = String(text).split(' ');
  return (
    <span className="split-words" aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="sw-mask" aria-hidden="true">
          <span className="sw-word" style={{ '--i': i, '--d': `${delay}ms` }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
