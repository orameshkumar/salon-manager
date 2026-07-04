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
      {/* Golden hexagon frame — outer */}
      <polygon
        points="50,3 91,27 91,73 50,97 9,73 9,27"
        fill="none" stroke="#d4af37" strokeWidth="2.5" opacity="0.9"
      />
      {/* Golden hexagon frame — inner faint */}
      <polygon
        points="50,10 84,30 84,70 50,90 16,70 16,30"
        fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.28"
      />

      {/*
        Scissors: two straight blades at ~30° opening.
        Handle rings at (20,32) and (20,68).
        Blades run from rings to tips at (86,40) and (86,60).
        Pivot screw at 1/4 of blade length from handle (~x=36).
      */}

      {/*
        Blades cross (X pattern): upper blade from top ring → lower-right tip,
        lower blade from bottom ring → upper-right tip.
        Natural crossing at ~1/4 from the handle side.
      */}
      {/* Upper blade: top-left ring → lower-right tip */}
      <line x1="19" y1="38" x2="86" y2="82"
        stroke="currentColor" strokeWidth="8.5" strokeLinecap="round"/>
      {/* Lower blade: bottom-left ring → upper-right tip */}
      <line x1="19" y1="62" x2="86" y2="18"
        stroke="currentColor" strokeWidth="8.5" strokeLinecap="round"/>

      {/* Pivot screw at crossing ~(35, 50) = 1/4 from handle */}
      <circle cx="35" cy="50" r="5" fill="#d4af37"/>
      <circle cx="35" cy="50" r="2.4" fill="#92660a"/>

      {/* Handle ring — upper */}
      <circle cx="19" cy="38" r="11" fill="none" stroke="currentColor" strokeWidth="5.5"/>
      {/* Handle ring — lower */}
      <circle cx="19" cy="62" r="11" fill="none" stroke="currentColor" strokeWidth="5.5"/>

      {/* Gold sparkle dots near blade tips */}
      <circle cx="88" cy="32" r="3.5" fill="#d4af37"/>
      <circle cx="91" cy="43" r="2"   fill="#d4af37" opacity="0.7"/>
      <circle cx="85" cy="26" r="1.5" fill="#fde68a" opacity="0.8"/>
    </svg>
  )
}
