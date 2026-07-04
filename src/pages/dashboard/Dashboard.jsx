import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebase/config'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { format, startOfDay, endOfDay } from 'date-fns'

const STATUS_BADGE = {
  scheduled: 'badge-blue',
  completed:  'badge-green',
  cancelled:  'badge-red',
  'no-show':  'badge-yellow',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]             = useState({ appointments: 0, revenue: 0, newCustomers: 0, lowStock: 0 })
  const [appointments, setAppointments] = useState([])
  const today = new Date()

  useEffect(() => {
    async function loadStats() {
      const start = Timestamp.fromDate(startOfDay(today))
      const end   = Timestamp.fromDate(endOfDay(today))

      const [apptSnap, invoiceSnap, custSnap, stockSnap] = await Promise.all([
        getDocs(query(collection(db, 'appointments'), where('date', '>=', start), where('date', '<=', end))),
        getDocs(query(collection(db, 'invoices'),     where('createdAt', '>=', start), where('createdAt', '<=', end))),
        getDocs(query(collection(db, 'customers'),    where('createdAt', '>=', start), where('createdAt', '<=', end))),
        getDocs(collection(db, 'inventory')),
      ])

      const revenue = invoiceSnap.docs.reduce((sum, d) => sum + (d.data().total ?? 0), 0)
      const appts   = apptSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = a.date?.toDate?.()?.getTime() ?? 0
          const bt = b.date?.toDate?.()?.getTime() ?? 0
          return at - bt
        })

      const lowStock = stockSnap.docs.filter((d) => {
        const item = d.data()
        return (item.quantity ?? 0) <= (item.reorderLevel ?? 5)
      }).length
      setStats({ appointments: apptSnap.size, revenue, newCustomers: custSnap.size, lowStock })
      setAppointments(appts)
    }
    loadStats()
  }, [])

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Dashboard" subtitle={format(today, 'EEEE, d MMMM yyyy')} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's appointments" value={stats.appointments} color="brand" />
        <StatCard label="Today's revenue"       value={`₹${stats.revenue.toLocaleString()}`} color="green" />
        <StatCard label="New customers"         value={stats.newCustomers} color="blue" />
        <StatCard label="Low stock alerts"      value={stats.lowStock} color="amber" sub="items below reorder level" />
      </div>

      {/* Today's schedule */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800">Today's schedule</p>
          <button className="text-xs text-brand-600 hover:underline" onClick={() => navigate('/appointments')}>
            View all →
          </button>
        </div>
        {appointments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No appointments today</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Time', 'Customer', 'Service', 'Stylist', 'Station', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {a.date?.toDate ? format(a.date.toDate(), 'h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{a.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{a.service}</td>
                  <td className="px-4 py-3 text-gray-600">{a.stylist || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.stationName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGE[a.status] ?? 'badge-blue'}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card">
        <p className="text-sm font-medium text-gray-700 mb-4">Quick actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New appointment', to: '/appointments', emoji: '📅' },
            { label: 'New customer',    to: '/customers',    emoji: '👤' },
            { label: 'New invoice',     to: '/billing',      emoji: '🧾' },
            { label: 'Mark attendance', to: '/attendance',   emoji: '🕐' },
          ].map(({ label, to, emoji }) => (
            <button key={to} onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-center">
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
