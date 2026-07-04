export default function SalonLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Salon Manager logo"
    >
      {/* ── Golden hexagon frame ── */}
      <polygon
        points="50,3 91,27 91,73 50,97 9,73 9,27"
        fill="none" stroke="#d4af37" strokeWidth="2.5" opacity="0.9"
      />
      <polygon
        points="50,10 84,30 84,70 50,90 16,70 16,30"
        fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.28"
      />

      {/* ── Blade A: handle-ring top-left → tip top-right ── */}
      {/* Spine (back edge) and cutting edge form a tapered wedge */}
      <polygon
        points="36,20 75,16 73,22 38,32"
        fill="currentColor" opacity="0.95"
      />
      {/* Blade A shine */}
      <line x1="55" y1="37" x2="73" y2="18" stroke="#d4af37" strokeWidth="0.8" opacity="0.55"/>

      {/* ── Blade B: handle-ring bottom-left → tip bottom-right ── */}
      <polygon
        points="36,80 75,84 73,78 38,68"
        fill="currentColor" opacity="0.95"
      />
      {/* Blade B shine */}
      <line x1="55" y1="63" x2="73" y2="82" stroke="#d4af37" strokeWidth="0.8" opacity="0.55"/>

      {/* ── Pivot screw ── */}
      <circle cx="50" cy="50" r="5"   fill="#d4af37"/>
      <circle cx="50" cy="50" r="2.8" fill="#92660a"/>
      {/* screw cross slot */}
      <line x1="48" y1="50" x2="52" y2="50" stroke="#d4af37" strokeWidth="1" opacity="0.6"/>
      <line x1="50" y1="48" x2="50" y2="52" stroke="#d4af37" strokeWidth="1" opacity="0.6"/>

      {/* ── Handle ring 1 (top-left) ── */}
      <circle cx="27" cy="23" r="12" fill="none" stroke="currentColor" strokeWidth="5"/>
      <circle cx="27" cy="23" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"/>
      {/* thumb rest notch */}
      <path d="M33,16 Q38,13 36,20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>

      {/* ── Handle ring 2 (bottom-left) ── */}
      <circle cx="27" cy="77" r="12" fill="none" stroke="currentColor" strokeWidth="5"/>
      <circle cx="27" cy="77" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"/>

      {/* ── Gold sparkle diamond ── */}
      <polygon points="80,16 83,23 80,30 77,23" fill="#d4af37"/>
      <circle cx="86" cy="35" r="2.5" fill="currentColor" opacity="0.65"/>
      <circle cx="79" cy="10" r="1.6" fill="#fde68a" opacity="0.7"/>
    </svg>
  )
}
