import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Customers from './pages/customers/Customers'
import Appointments from './pages/appointments/Appointments'
import Billing from './pages/billing/Billing'
import Inventory from './pages/inventory/Inventory'
import Attendance from './pages/attendance/Attendance'
import Staff, { ADMIN_ROLES } from './pages/staff/Staff'
import Services from './pages/services/Services'
import Settings from './pages/settings/Settings'
import Reports from './pages/reports/Reports'
import Stations from './pages/stations/Stations'
import CustomerProfile from './pages/customers/CustomerProfile'
import Payroll from './pages/payroll/Payroll'
import Expenses from './pages/expenses/Expenses'
import CommissionRules from './pages/commissionRules/CommissionRules'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function ManagerRoute({ children }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!(profile?.roles ?? []).some((r) => ADMIN_ROLES.includes(r))) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
      <Route path="/staff" element={<ManagerRoute><Staff /></ManagerRoute>} />
      <Route path="/services" element={<ManagerRoute><Services /></ManagerRoute>} />
      <Route path="/settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
      <Route path="/reports" element={<ManagerRoute><Reports /></ManagerRoute>} />
      <Route path="/stations" element={<ManagerRoute><Stations /></ManagerRoute>} />
      <Route path="/payroll" element={<ManagerRoute><Payroll /></ManagerRoute>} />
      <Route path="/expenses" element={<ManagerRoute><Expenses /></ManagerRoute>} />
      <Route path="/commission-rules" element={<ManagerRoute><CommissionRules /></ManagerRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
