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

      {/* Scissors — Concept 1: crossed lines + circle handles */}
      <line x1="34" y1="28" x2="72" y2="72" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
      <line x1="34" y1="72" x2="72" y2="28" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
      <circle cx="30" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="5"/>
      <circle cx="30" cy="76" r="10" fill="none" stroke="currentColor" strokeWidth="5"/>

      {/* Gold sparkle dots */}
      <circle cx="78" cy="20" r="3.5" fill="#d4af37"/>
      <circle cx="84" cy="30" r="2.2" fill="#d4af37" opacity="0.7"/>
      <circle cx="76" cy="13" r="1.5" fill="#fde68a" opacity="0.8"/>
    </svg>
  )
}
