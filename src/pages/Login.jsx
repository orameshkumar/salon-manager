import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

function LogoBig() {
  return (
    <svg width="88" height="88" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Salon Manager">
      {/* Golden hexagon — outer */}
      <polygon points="50,3 91,27 91,73 50,97 9,73 9,27" fill="none" stroke="#d4af37" strokeWidth="2.5" opacity="0.9"/>
      {/* Golden hexagon — inner faint */}
      <polygon points="50,10 84,30 84,70 50,90 16,70 16,30" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.28"/>

      {/* Scissors: bent at pivot, 1/4 from handle, 30° opening */}
      <path d="M20,31 L33,50 L82,38" fill="none" stroke="#f9a8d4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20,69 L33,50 L82,62" fill="none" stroke="#f9a8d4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Pivot screw */}
      <circle cx="33" cy="50" r="4.5" fill="#d4af37"/>
      <circle cx="33" cy="50" r="2.5" fill="#92660a"/>

      {/* Handle rings */}
      <circle cx="18" cy="28" r="9" fill="none" stroke="#f9a8d4" strokeWidth="5"/>
      <circle cx="18" cy="72" r="9" fill="none" stroke="#f9a8d4" strokeWidth="5"/>

      {/* Gold sparkle dots */}
      <circle cx="86" cy="33" r="3.5" fill="#d4af37"/>
      <circle cx="89" cy="44" r="2.2" fill="#d4af37" opacity="0.7"/>
      <circle cx="83" cy="26" r="1.5" fill="#fde68a" opacity="0.8"/>
    </svg>
  )
}

const FEATURES = [
  { icon: '🧾', label: 'Smart billing & invoicing' },
  { icon: '📅', label: 'Appointment scheduling' },
  { icon: '💰', label: 'Payroll & commissions' },
  { icon: '📊', label: 'Reports & analytics' },
]

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/')
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left: Brand Banner ── */}
      <div className="relative flex flex-col justify-between md:w-1/2 bg-gray-900 px-10 py-12 overflow-hidden">

        {/* Background decorative diamonds */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* large faint diamond top-right */}
          <polygon points="460,20 560,100 560,220 460,300 360,220 360,100" fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.12"/>
          <polygon points="460,50 530,100 530,210 460,260 390,210 390,100" fill="none" stroke="#d4af37" strokeWidth="0.75" opacity="0.08"/>
          {/* large faint diamond bottom-left */}
          <polygon points="40,420 150,490 150,630 40,700 -70,630 -70,490" fill="none" stroke="#f472b6" strokeWidth="1" opacity="0.1"/>
          {/* small accent dots */}
          <circle cx="400" cy="340" r="2" fill="#d4af37" opacity="0.4"/>
          <circle cx="415" cy="355" r="1.2" fill="#f472b6" opacity="0.4"/>
          <circle cx="80"  cy="200" r="1.8" fill="#d4af37" opacity="0.3"/>
          <circle cx="420" cy="560" r="1.5" fill="#f9a8d4" opacity="0.35"/>
        </svg>

        {/* Top: Logo + brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <LogoBig />
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Salon</h1>
              <p className="text-xl font-light text-pink-300 tracking-widest uppercase">Manager</p>
            </div>
          </div>

          <div className="mb-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium tracking-widest uppercase"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#fde68a', border: '1px solid rgba(212,175,55,0.3)' }}>
              Beauty • Billing • Beyond
            </span>
          </div>

          <h2 className="text-2xl font-semibold text-white mt-5 leading-snug">
            Everything your salon<br />
            needs, in one place.
          </h2>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-xs">
            Manage staff, track appointments, generate invoices, and grow your salon business — all from a single dashboard.
          </p>
        </div>

        {/* Middle: Feature list */}
        <div className="relative z-10 space-y-3 my-10">
          {FEATURES.map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                style={{ background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.25)' }}>
                {icon}
              </div>
              <span className="text-sm text-gray-300">{label}</span>
            </div>
          ))}
        </div>

        {/* Bottom: gold rule */}
        <div className="relative z-10">
          <div className="h-px w-16 mb-4" style={{ background: 'linear-gradient(90deg, #d4af37, transparent)' }}/>
          <p className="text-xs text-gray-600 tracking-wide">© 2026 Salon Manager</p>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex flex-col justify-center md:w-1/2 bg-white px-8 py-12 md:px-16">
        <div className="w-full max-w-sm mx-auto">

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to continue to your salon dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="staff@salon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5 mt-2" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-8 text-center">
            Trouble signing in? Contact your salon admin.
          </p>
        </div>
      </div>

    </div>
  )
}
