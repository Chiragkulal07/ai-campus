import { useState } from 'react';

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

  const handlePick = async (color) => {
    setSelected(color);
    setSaving(true);
    const res = await fetch('http://localhost:4000/profile/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bodyColor: color }),
    });
    const data = await res.json();
    setSaving(false);
    onUpdated(data.avatar);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Your color:
      </span>
      <div style={{ display: 'flex', gap: '6px' }}>
        {COLORS.map(({ value }) => (
          <button
            key={value}
            title={value}
            onClick={() => handlePick(value)}
            style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: value, border: 'none', cursor: 'pointer', padding: 0,
              outline: selected === value ? `3px solid white` : '3px solid transparent',
              outlineOffset: '2px',
              transform: selected === value ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.15s',
              boxShadow: selected === value ? `0 0 8px ${value}80` : 'none',
            }}
          />
        ))}
      </div>
      {saving && <span style={{ color: '#64748b', fontSize: '11px' }}>saving…</span>}
    </div>
  );
}

export default AvatarPicker;