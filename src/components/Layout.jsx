import { NavLink, useNavigate } from 'react-router-dom'
import { ADMIN_ROLES } from '../pages/staff/Staff'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

// roles: undefined = all roles; otherwise array of allowed roles
const NAV = [
  { to: '/',             label: 'Dashboard',    icon: '⊞' },
  { to: '/customers',    label: 'Customers',    icon: '👤' },
  { to: '/appointments', label: 'Appointments', icon: '📅' },
  { to: '/billing',      label: 'Billing',      icon: '🧾' },
  { to: '/inventory',    label: 'Inventory',    icon: '📦' },
  { to: '/attendance',   label: 'Attendance',   icon: '🕐' },
  { to: '/staff',        label: 'Staff',        icon: '👥',  roles: ADMIN_ROLES },
  { to: '/stations',     label: 'Stations',     icon: '💺',  roles: ADMIN_ROLES },
  { to: '/services',     label: 'Services',     icon: '✂',   roles: ADMIN_ROLES },
  { to: '/reports',      label: 'Reports',      icon: '📊',  roles: ADMIN_ROLES },
  { to: '/settings',     label: 'Settings',     icon: '⚙',   roles: ADMIN_ROLES },
]

export default function Layout({ children }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <h1 className="text-base font-semibold text-brand-700">✂ Salon Manager</h1>
          <p className="text-xs text-gray-500 mt-0.5">{profile?.branchName ?? 'Main Branch'}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.filter(({ roles }) => !roles || roles.includes(profile?.role)).map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-800 truncate">{profile?.name ?? 'Staff'}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role ?? 'receptionist'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
