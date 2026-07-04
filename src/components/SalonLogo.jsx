export default function SalonLogo({ size = 32, className = '' }) {
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r  = s * 0.44   // diamond hex radius
  const sc = s * 0.38   // scissors scale

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Salon Manager logo"
    >
      {/* Diamond hexagon outline */}
      <polygon
        points="50,4 88,28 88,72 50,96 12,72 12,28"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />

      {/* Scissors blade 1 */}
      <line x1="30" y1="28" x2="72" y2="72" stroke="url(#lg1)" strokeWidth="7" strokeLinecap="round"/>
      {/* Scissors blade 2 */}
      <line x1="30" y1="72" x2="72" y2="28" stroke="url(#lg1)" strokeWidth="7" strokeLinecap="round"/>

      {/* Handle rings */}
      <circle cx="26" cy="24" r="10" fill="none" stroke="url(#lg1)" strokeWidth="5"/>
      <circle cx="26" cy="76" r="10" fill="none" stroke="url(#lg1)" strokeWidth="5"/>

      {/* Gold diamond sparkle */}
      <polygon points="76,22 79,29 76,36 73,29" fill="#d4af37"/>

      {/* Pink sparkle dots */}
      <circle cx="82" cy="40" r="3.5" fill="#f472b6" opacity="0.9"/>
      <circle cx="78" cy="14" r="2.5" fill="#f9d76e" opacity="0.75"/>

      <defs>
        <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f472b6"/>
          <stop offset="100%" stopColor="#be185d"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
