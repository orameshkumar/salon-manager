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
      {/* Golden hexagon frame */}
      <polygon
        points="50,3 91,27 91,73 50,97 9,73 9,27"
        fill="none" stroke="#d4af37" strokeWidth="2.5" opacity="0.9"
      />
      <polygon
        points="50,10 84,30 84,70 50,90 16,70 16,30"
        fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.28"
      />

      {/*
        Classic scissors icon:
          Upper blade: from upper ring (cx=22,cy=32) through pivot (45,50) to tip (84,34)
          Lower blade: from lower ring (cx=22,cy=68) through pivot (45,50) to tip (84,66)
          Rings are solid-stroke circles, pivot visible as gold dot.
      */}

      {/* Upper blade */}
      <line x1="30" y1="37" x2="84" y2="34"
        stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      {/* Upper blade — handle shank to ring */}
      <line x1="22" y1="32" x2="45" y2="47"
        stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>

      {/* Lower blade */}
      <line x1="30" y1="63" x2="84" y2="66"
        stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      {/* Lower blade — handle shank to ring */}
      <line x1="22" y1="68" x2="45" y2="53"
        stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>

      {/* Pivot screw */}
      <circle cx="45" cy="50" r="4.5" fill="#d4af37"/>
      <circle cx="45" cy="50" r="2.2" fill="#92660a"/>

      {/* Handle ring 1 — upper */}
      <circle cx="20" cy="31" r="11" fill="none" stroke="currentColor" strokeWidth="5.5"/>

      {/* Handle ring 2 — lower */}
      <circle cx="20" cy="69" r="11" fill="none" stroke="currentColor" strokeWidth="5.5"/>

      {/* Gold sparkle dots */}
      <circle cx="87" cy="28" r="3.5" fill="#d4af37"/>
      <circle cx="90" cy="40" r="2"   fill="#d4af37" opacity="0.7"/>
      <circle cx="84" cy="22" r="1.5" fill="#fde68a" opacity="0.8"/>
    </svg>
  )
}
