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
        Scissors geometry:
          Pivot at (33,50) — roughly 1/4 from handle rings.
          Shanks angle outward so rings are nicely spread.
          Blades extend at ±15° (30° total) from pivot to tips.

          Upper: ring(20,31) → shank → pivot(33,50) → blade → tip(82,38)
          Lower: ring(20,69) → shank → pivot(33,50) → blade → tip(82,62)
      */}
      <path
        d="M20,31 L33,50 L82,38"
        fill="none" stroke="currentColor" strokeWidth="7"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M20,69 L33,50 L82,62"
        fill="none" stroke="currentColor" strokeWidth="7"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Pivot screw */}
      <circle cx="33" cy="50" r="4.5" fill="#d4af37"/>
      <circle cx="33" cy="50" r="2.5" fill="#92660a"/>

      {/* Handle rings */}
      <circle cx="18" cy="28" r="9" fill="none" stroke="currentColor" strokeWidth="5"/>
      <circle cx="18" cy="72" r="9" fill="none" stroke="currentColor" strokeWidth="5"/>

      {/* Gold sparkle dots near tips */}
      <circle cx="86" cy="33" r="3.5" fill="#d4af37"/>
      <circle cx="89" cy="44" r="2.2" fill="#d4af37" opacity="0.7"/>
      <circle cx="83" cy="26" r="1.5" fill="#fde68a" opacity="0.8"/>
    </svg>
  )
}
