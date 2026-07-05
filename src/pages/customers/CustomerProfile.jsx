import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import { format } from 'date-fns'

const STATUS_BADGE = {
  scheduled: 'badge-blue',
  completed:  'badge-green',
  cancelled:  'badge-red',
  'no-show':  'badge-yellow',
}

export default function CustomerProfile() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading,  setLoading]  = useState(true)

  const { docs: allAppointments } = useCollection('appointments', 'date')
  const { docs: allInvoices }     = useCollection('invoices')

  useEffect(() => {
    getDoc(doc(db, 'customers', id)).then((snap) => {
      setCustomer(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      setLoading(false)
    })
  }, [id])

  const appointments = allAppointments.filter((a) => a.customerId === id || a.customerPhone === customer?.phone)
  const invoices     = allInvoices.filter((i) => i.customerId === id)
  const totalSpend   = invoices.reduce((s, i) => s + (i.total ?? 0), 0)

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>
  if (!customer) return (
    <div className="p-6">
      <p className="text-sm text-gray-500">Customer not found.</p>
      <button className="btn-secondary mt-3" onClick={() => navigate('/customers')}>Back</button>
    </div>
  )

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate('/customers')}
            className="text-xs text-gray-500 hover:text-brand-600 mb-2 flex items-center gap-1">
            ← Back to customers
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer.phone} {customer.email ? `· ${customer.email}` : ''}</p>
          {customer.allergies && (
            <p className="text-xs text-red-600 mt-1">⚠ Allergies: {customer.allergies}</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="card py-2 px-3">
            <p className="text-xl font-semibold text-brand-700">{customer.totalVisits ?? 0}</p>
            <p className="text-xs text-gray-500">Visits</p>
          </div>
          <div className="card py-2 px-3">
            <p className="text-xl font-semibold text-amber-600">{customer.loyaltyPoints ?? 0}</p>
            <p className="text-xs text-gray-500">Points</p>
          </div>
          <div className="card py-2 px-3">
            <p className="text-xl font-semibold text-green-600">₹{totalSpend.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total spend</p>
          </div>
        </div>
      </div>

      {/* Appointment history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800">Appointment history ({appointments.length})</p>
        </div>
        {appointments.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">No appointments yet</p>
          : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date & time', 'Service', 'Stylist', 'Station', 'Status', 'Notes'].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {a.date?.toDate ? format(a.date.toDate(), 'dd MMM yyyy, h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{a.service}</td>
                    <td className="px-4 py-3 text-gray-600">{a.stylist || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{a.stationName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[a.status] ?? 'badge-blue'}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </div>

      {/* Invoice history */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-800">Invoice history ({invoices.length})</p>
        </div>
        {invoices.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">No invoices yet</p>
          : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Services', 'Subtotal', 'Discount', 'Total', 'Points', 'Payment'].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {inv.createdAt?.toDate ? format(inv.createdAt.toDate(), 'dd MMM yyyy, h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{inv.services?.map((s) => s.name).join(', ')}</td>
                    <td className="px-4 py-3 text-gray-600">₹{inv.subtotal}</td>
                    <td className="px-4 py-3 text-gray-600">₹{inv.discount ?? 0}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{inv.total}</td>
                    <td className="px-4 py-3 text-amber-600 text-xs">+{inv.pointsEarned ?? 0}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{inv.paymentMode}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </div>
    </div>
  )
}
