import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ADMIN_ROLES } from '../pages/staff/Staff'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useTheme, THEMES } from '../context/ThemeContext'
import SalonLogo from './SalonLogo'

const NAV = [
  { to: '/',             label: 'Dashboard',    icon: '⊞' },
  { to: '/customers',    label: 'Customers',    icon: '👤' },
  { to: '/appointments', label: 'Appointments', icon: '📅' },
  { to: '/billing',      label: 'Billing',      icon: '🧾' },
  { to: '/inventory',    label: 'Inventory',    icon: '📦' },
  { to: '/attendance',   label: 'Attendance',   icon: '🕐' },
  { to: '/staff',        label: 'Staff',        icon: '👥', roles: ADMIN_ROLES },
  { to: '/stations',     label: 'Stations',     icon: '💺', roles: ADMIN_ROLES },
  { to: '/services',     label: 'Services',     icon: '✂',  roles: ADMIN_ROLES },
  { to: '/payroll',          label: 'Payroll',      icon: '💰', roles: ADMIN_ROLES },
  { to: '/expenses',         label: 'Expenses',     icon: '💸', roles: ADMIN_ROLES },
  { to: '/commission-rules', label: 'Commission',   icon: '🎯', roles: ADMIN_ROLES },
  { to: '/reports',  label: 'Reports',  icon: '📊', roles: ADMIN_ROLES },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ children }) {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login')
  }

  const visibleNav = NAV.filter(({ roles: allowed }) =>
    !allowed || (profile?.roles ?? []).some((r) => allowed.includes(r))
  )

  const SidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SalonLogo size={28} className="text-brand-600 flex-shrink-0" />
            <h1 className="text-base font-semibold text-brand-700">Salon Manager</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{profile?.branchName ?? 'Main Branch'}</p>
        </div>
        {/* Close button — mobile only */}
        <button className="md:hidden p-1 rounded text-gray-500 hover:bg-gray-100" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        {/* Theme switcher */}
        <div className="px-3 mb-3">
          <p className="text-xs text-gray-400 mb-1.5">Theme</p>
          <div className="flex gap-1.5 flex-wrap">
            {THEMES.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => setTheme(t.id)}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${theme === t.id ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: t.color }}
              />
            ))}
          </div>
        </div>
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-800 truncate">{profile?.name ?? 'Staff'}</p>
          <p className="text-xs text-gray-500 capitalize">
            {(profile?.roles ?? []).join(', ') || 'staff'}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        {SidebarContent}
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-white flex flex-col shadow-xl z-50">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <SalonLogo size={22} className="text-brand-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-brand-700">Salon Manager</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
