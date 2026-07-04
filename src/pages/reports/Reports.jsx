import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import PageHeader from '../../components/PageHeader'
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'

const RANGES = ['Today', 'This month', 'Last month', 'Last 3 months', 'Last 6 months', 'Custom']

function getRange(range, custom) {
  const now = new Date()
  switch (range) {
    case 'Today':        return { start: startOfDay(now), end: endOfDay(now) }
    case 'This month':   return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'Last month':   return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }
    case 'Last 3 months': return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    case 'Last 6 months': return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }
    case 'Custom':       return { start: startOfDay(new Date(custom.from)), end: endOfDay(new Date(custom.to)) }
    default:             return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

export default function Reports() {
  const [range, setRange]     = useState('This month')
  const [custom, setCustom]   = useState({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (range === 'Custom' && (!custom.from || !custom.to)) return
    loadReport()
  }, [range, custom])

  async function loadReport() {
    setLoading(true)
    try {
      const { start, end } = getRange(range, custom)
      const s = Timestamp.fromDate(start)
      const e = Timestamp.fromDate(end)

      const [invoiceSnap, apptSnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, 'invoices'),     where('createdAt', '>=', s), where('createdAt', '<=', e))),
        getDocs(query(collection(db, 'appointments'), where('createdAt', '>=', s), where('createdAt', '<=', e))),
        getDocs(query(collection(db, 'customers'),    where('createdAt', '>=', s), where('createdAt', '<=', e))),
      ])

      const invoices     = invoiceSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const appointments = apptSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const totalRevenue  = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
      const totalDiscount = invoices.reduce((s, i) => s + (i.discount ?? 0), 0)
      const totalPoints   = invoices.reduce((s, i) => s + (i.pointsEarned ?? 0), 0)

      // Revenue by payment mode
      const byPayment = invoices.reduce((acc, i) => {
        acc[i.paymentMode] = (acc[i.paymentMode] ?? 0) + (i.total ?? 0)
        return acc
      }, {})

      // Top services
      const svcMap = {}
      invoices.forEach((inv) => {
        inv.services?.forEach((s) => {
          svcMap[s.name] = svcMap[s.name] ?? { count: 0, revenue: 0 }
          svcMap[s.name].count++
          svcMap[s.name].revenue += s.price ?? 0
        })
      })
      const topServices = Object.entries(svcMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)

      // Appointment stats
      const apptByStatus = appointments.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1
        return acc
      }, {})

      // Monthly revenue trend (only for ranges > 1 month)
      const months = eachMonthOfInterval({ start, end })
      const monthlyRevenue = months.map((m) => {
        const ms = Timestamp.fromDate(startOfMonth(m))
        const me = Timestamp.fromDate(endOfMonth(m))
        const rev = invoices
          .filter((i) => {
            const d = i.createdAt?.toDate?.()
            return d && d >= ms.toDate() && d <= me.toDate()
          })
          .reduce((s, i) => s + (i.total ?? 0), 0)
        return { month: format(m, 'MMM yyyy'), revenue: rev }
      })

      setData({
        totalRevenue, totalDiscount, totalPoints,
        invoiceCount: invoices.length,
        apptCount: appointments.length,
        newCustomers: custSnap.size,
        avgBill: invoices.length ? Math.round(totalRevenue / invoices.length) : 0,
        byPayment, topServices, apptByStatus, monthlyRevenue,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <PageHeader title="Reports" subtitle="Business analytics" />

      {/* Range selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              range === r ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {r}
          </button>
        ))}
        {range === 'Custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" className="input w-36" value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <span className="text-xs text-gray-500">to</span>
            <input type="date" className="input w-36" value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading report…</p>}

      {!loading && data && (
        <div className="space-y-6">

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total revenue',   value: `₹${data.totalRevenue.toLocaleString()}`, color: 'text-brand-700' },
              { label: 'Invoices',        value: data.invoiceCount,                         color: 'text-blue-600' },
              { label: 'Avg bill value',  value: `₹${data.avgBill.toLocaleString()}`,       color: 'text-green-600' },
              { label: 'New customers',   value: data.newCustomers,                         color: 'text-purple-600' },
              { label: 'Appointments',    value: data.apptCount,                            color: 'text-blue-600' },
              { label: 'Total discount',  value: `₹${data.totalDiscount.toLocaleString()}`, color: 'text-amber-600' },
              { label: 'Points awarded',  value: data.totalPoints,                          color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top services */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-800 mb-4">Top services by revenue</p>
              {data.topServices.length === 0
                ? <p className="text-sm text-gray-400">No data</p>
                : (
                  <div className="space-y-3">
                    {data.topServices.map(([name, { count, revenue }], i) => {
                      const maxRev = data.topServices[0][1].revenue
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{i + 1}. {name}</span>
                            <span className="text-gray-500">{count}x · ₹{revenue.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-brand-500"
                              style={{ width: `${(revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>

            {/* Payment breakdown */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-800 mb-4">Revenue by payment mode</p>
              {Object.keys(data.byPayment).length === 0
                ? <p className="text-sm text-gray-400">No data</p>
                : (
                  <div className="space-y-3">
                    {Object.entries(data.byPayment).sort((a, b) => b[1] - a[1]).map(([mode, rev]) => {
                      const pct = Math.round((rev / data.totalRevenue) * 100)
                      return (
                        <div key={mode}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{mode}</span>
                            <span className="text-gray-500">₹{rev.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>

            {/* Appointment status */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-800 mb-4">Appointment status</p>
              {Object.keys(data.apptByStatus).length === 0
                ? <p className="text-sm text-gray-400">No data</p>
                : (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(data.apptByStatus).map(([status, count]) => (
                      <div key={status} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xl font-semibold text-gray-800">{count}</p>
                        <p className="text-xs text-gray-500 capitalize">{status}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Monthly trend */}
            {data.monthlyRevenue.length > 1 && (
              <div className="card">
                <p className="text-sm font-semibold text-gray-800 mb-4">Monthly revenue trend</p>
                <div className="space-y-2">
                  {data.monthlyRevenue.map(({ month, revenue }) => {
                    const max = Math.max(...data.monthlyRevenue.map((m) => m.revenue), 1)
                    return (
                      <div key={month}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{month}</span>
                          <span className="font-medium text-gray-800">₹{revenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-brand-400"
                            style={{ width: `${(revenue / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
