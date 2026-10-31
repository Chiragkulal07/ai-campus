export function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

// Parse a fetch Response as JSON without throwing on empty or non-JSON bodies.
export async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function formatDuration(totalSec) {
  const sec = Number(totalSec) || 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m} min`;
}
