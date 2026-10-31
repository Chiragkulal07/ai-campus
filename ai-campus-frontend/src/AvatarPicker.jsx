import { useState } from 'react';
import { API_URL } from './config';
import { readJson } from './utils';

const COLORS = [
  { value: 'dodgerblue', label: 'Blue' },
  { value: 'crimson', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'seagreen', label: 'Green' },
  { value: 'purple', label: 'Purple' },
  { value: 'gold', label: 'Gold' },
];

function AvatarPicker({ token, currentColor, onUpdated }) {
  const [selected, setSelected] = useState(currentColor || 'dodgerblue');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePick = async (color) => {
    if (saving || color === selected) return;
    const previous = selected;
    setSelected(color);
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/profile/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bodyColor: color }),
      });
      const data = await readJson(res);
      if (!res.ok || !data.avatar) throw new Error(data.error || 'Could not save color');
      onUpdated(data.avatar);
    } catch (err) {
      setSelected(previous);
      setError(err.message || 'Could not save color');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="swatches" role="radiogroup" aria-label="Avatar color">
        {COLORS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected === value}
            aria-label={label}
            title={label}
            disabled={saving}
            onClick={() => handlePick(value)}
            className={`swatch ${selected === value ? 'is-selected' : ''}`}
            style={{ background: value }}
          />
        ))}
      </div>
      {saving && <div className="hint" style={{ marginTop: 8 }}>Saving…</div>}
      {error && <div className="hint" style={{ marginTop: 8, color: 'var(--red-text)' }}>{error}</div>}
    </div>
  );
}

export default AvatarPicker;
