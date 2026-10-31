// Blocky arena character (same pixel style as the campus avatar).
// (0,0) in the SVG is the player's position; the sprite is drawn around it.
//  • jacket colour = team (you: amber, others: rose)
//  • blaster arm follows `aimAngle` (radians) when provided, otherwise points forward
//  • legs walk while `moving`; the whole sprite mirrors when facing left

const SKIN = '#f3c597';
const HAIR = '#2b211c';
const PANTS = '#3a3430';
const BOOTS = '#1c1917';
const GUN = '#2a2522';

function ArenaFighter({ color, shade, facingLeft = false, aimAngle = null, moving = false }) {
  // Arm angle in the sprite's own (possibly mirrored) space, in degrees.
  let armDeg = 0;
  if (aimAngle !== null) {
    const local = facingLeft ? Math.PI - aimAngle : aimAngle;
    armDeg = (local * 180) / Math.PI;
  }

  return (
    <svg className={`af ${moving ? 'is-moving' : ''}`} viewBox="-22 -30 44 52" width="44" height="52" aria-hidden="true">
      {/* floor glow + shadow */}
      <ellipse className="af-glow" cx="0" cy="17" rx="13" ry="4" fill={color} />
      <ellipse cx="0" cy="17" rx="9" ry="2.6" fill="rgba(0,0,0,0.55)" />

      <g transform={facingLeft ? 'scale(-1,1)' : undefined}>
        <g className="af-body">
          {/* back leg */}
          <g className="af-leg af-leg-back">
            <rect x="-5" y="5" width="4.5" height="9" rx="1" fill={PANTS} />
            <rect x="-5.5" y="13" width="5.5" height="3" rx="1" fill={BOOTS} />
          </g>
          {/* front leg */}
          <g className="af-leg af-leg-front">
            <rect x="0.5" y="5" width="4.5" height="9" rx="1" fill={PANTS} />
            <rect x="0.5" y="13" width="5.5" height="3" rx="1" fill={BOOTS} />
          </g>

          {/* torso / jacket */}
          <rect x="-7" y="-7" width="14" height="13.5" rx="2.5" fill={color} />
          <rect x="-7" y="1.5" width="14" height="2" fill={shade} opacity="0.55" />
          <rect x="-0.6" y="-7" width="1.2" height="9" fill={shade} opacity="0.7" />
          <rect x="-7" y="4.5" width="14" height="2" rx="0.8" fill={BOOTS} />

          {/* head */}
          <rect x="-6" y="-20" width="12" height="12" rx="2.5" fill={SKIN} />
          <rect x="-6.4" y="-21" width="12.8" height="4.2" rx="2" fill={HAIR} />
          <rect x="-6.4" y="-19" width="2.6" height="6" rx="1" fill={HAIR} />
          {/* visor band in team colour */}
          <rect x="-1" y="-15.2" width="7.4" height="2.6" rx="1.2" fill={color} opacity="0.95" />
          <rect x="2.6" y="-14.6" width="1.8" height="1.4" rx="0.5" fill="#fff" opacity="0.9" />

          {/* blaster arm (rotates around the shoulder) */}
          <g transform={`translate(1.5 -3) rotate(${armDeg})`}>
            <rect x="-1" y="-1.8" width="8" height="3.6" rx="1.6" fill={shade} />
            <circle cx="7.2" cy="0" r="2" fill={SKIN} />
            <rect x="7" y="-2.6" width="9.5" height="4.2" rx="1.2" fill={GUN} />
            <rect x="9" y="1.2" width="2.4" height="3" rx="0.6" fill={GUN} />
            <rect className="af-muzzle" x="15.5" y="-1.9" width="2.6" height="2.8" rx="0.8" fill={color} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export default ArenaFighter;
