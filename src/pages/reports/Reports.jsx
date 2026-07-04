import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import PageHeader from '../../components/PageHeader'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const PRESETS = [
  { label: 'This month',    key: 'thisMonth' },
  { label: 'Last month',    key: 'lastMonth' },
  { label: 'Last 3 months', key: 'last3' },
  { label: 'Last 6 months', key: 'last6' },
  { label: 'Custom',        key: 'custom' },
]

function getPresetDates(key) {
  const now = new Date()
  const fmt = (d) => format(d, 'yyyy-MM-dd')
  if (key === 'thisMonth') return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) }
  if (key === 'lastMonth') {
    const lm = subMonths(now, 1)
    return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) }
  }
  if (key === 'last3') return { from: fmt(startOfMonth(subMonths(now, 2))), to: fmt(endOfMonth(now)) }
  if (key === 'last6') return { from: fmt(startOfMonth(subMonths(now, 5))), to: fmt(endOfMonth(now)) }
  return null
}

export default function Reports() {
  const [preset,  setPreset]  = useState('thisMonth')
  const [from,    setFrom]    = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,      setTo]      = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [data,    setData]    = useState(null)

  function applyPreset(key) {
    setPreset(key)
    if (key !== 'custom') {
      const d = getPresetDates(key)
      setFrom(d.from)
      setTo(d.to)
    }
  }

  async function fetchReport() {
    setLoading(true)
    try {
      const fromDate = new Date(from + 'T00:00:00')
      const toDate   = new Date(to   + 'T23:59:59')

      // ── Invoices ──
      const invSnap = await getDocs(
        query(collection(db, 'invoices'),
          where('createdAt', '>=', fromDate),
          where('createdAt', '<=', toDate))
      )
      const invoices = invSnap.docs.map((d) => d.data())

      const serviceMap = {}
      let totalRevenue = 0
      for (const inv of invoices) {
        totalRevenue += inv.total ?? 0
        for (const svc of inv.services ?? []) {
          serviceMap[svc.name] = (serviceMap[svc.name] ?? 0) + (svc.price ?? 0)
        }
      }

      const paymentMap = {}
      for (const inv of invoices) {
        const m = inv.paymentMode ?? 'Unknown'
        paymentMap[m] = (paymentMap[m] ?? 0) + (inv.total ?? 0)
      }

      // ── Expenses ──
      const expSnap = await getDocs(
        query(collection(db, 'expenses'),
          where('date', '>=', from),
          where('date', '<=', to))
      )
      const expenses = expSnap.docs.map((d) => d.data())
      const expByType = {}
      let totalExpenses = 0
      for (const exp of expenses) {
        expByType[exp.type] = (expByType[exp.type] ?? 0) + (exp.amount ?? 0)
        totalExpenses += exp.amount ?? 0
      }

      // ── Salaries (by month range) ──
      const fromMonth = from.slice(0, 7)
      const toMonth   = to.slice(0, 7)
      const salSnap = await getDocs(
        query(collection(db, 'salaries'),
          where('month', '>=', fromMonth),
          where('month', '<=', toMonth))
      )
      const salaries = salSnap.docs.map((d) => d.data())
      const totalSalary = salaries.reduce((s, r) => s + (r.total ?? 0), 0)
      if (totalSalary > 0) {
        expByType['Salary'] = (expByType['Salary'] ?? 0) + totalSalary
        totalExpenses += totalSalary
      }

      setData({
        totalRevenue, totalExpenses,
        profit:       totalRevenue - totalExpenses,
        serviceMap,   paymentMap,
        expByType,
        invoiceCount: invoices.length,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [from, to]) // eslint-disable-line

  const serviceRows = data ? Object.entries(data.serviceMap).sort((a, b) => b[1] - a[1]) : []
  const expenseRows = data ? Object.entries(data.expByType).sort((a, b) => b[1] - a[1])  : []
  const paymentRows = data ? Object.entries(data.paymentMap).sort((a, b) => b[1] - a[1]) : []

  const maxSvc = serviceRows[0]?.[1] ?? 1
  const maxExp = expenseRows[0]?.[1] ?? 1

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Reports" subtitle="Revenue, expenses & profit/loss" />

      {/* Date range controls */}
      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <input type="date" className="input w-full sm:w-44" value={from}
              onChange={(e) => { setFrom(e.target.value); setPreset('custom') }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <input type="date" className="input w-full sm:w-44" value={to}
              onChange={(e) => { setTo(e.target.value); setPreset('custom') }} />
          </div>
          <button className="btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading…' : 'Run report'}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 text-center py-8">Fetching data…</p>}

      {!loading && data && (
        <>
          {/* Profit / Loss summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center py-4">
              <p className="text-xs text-gray-500 mb-1">Total revenue</p>
              <p className="text-2xl font-bold text-green-600">₹{data.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">{data.invoiceCount} invoices</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-xs text-gray-500 mb-1">Total expenses</p>
              <p className="text-2xl font-bold text-red-500">₹{data.totalExpenses.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">all categories</p>
            </div>
            <div className={`card text-center py-4 ${data.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-gray-500 mb-1">Net profit / loss</p>
              <p className={`text-2xl font-bold ${data.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {data.profit >= 0 ? '+' : ''}₹{data.profit.toLocaleString()}
              </p>
              <p className={`text-xs mt-1 font-medium ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.profit >= 0 ? 'Profit' : 'Loss'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by service */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-800 mb-4">Revenue by service</p>
              {serviceRows.length === 0
                ? <p className="text-sm text-gray-400">No service revenue in this period</p>
                : (
                  <div className="space-y-3">
                    {serviceRows.map(([name, amount]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium">{name}</span>
                          <span className="text-gray-600">₹{amount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${(amount / maxSvc) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Expenses by category */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-800 mb-4">Expenses by category</p>
              {expenseRows.length === 0
                ? <p className="text-sm text-gray-400">No expenses in this period</p>
                : (
                  <div className="space-y-3">
                    {expenseRows.map(([type, amount]) => (
                      <div key={type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 font-medium">{type}</span>
                          <span className="text-gray-600">₹{amount.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full"
                            style={{ width: `${(amount / maxExp) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Payment mode */}
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-4">Revenue by payment mode</p>
            {paymentRows.length === 0
              ? <p className="text-sm text-gray-400">No payments in this period</p>
              : (
                <div className="flex flex-wrap gap-4">
                  {paymentRows.map(([mode, amount]) => (
                    <div key={mode} className="flex-1 min-w-[120px] text-center card py-3 px-4">
                      <p className="text-lg font-semibold text-brand-700">₹{amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{mode}</p>
                      <p className="text-xs text-gray-400">
                        {data.totalRevenue > 0 ? Math.round((amount / data.totalRevenue) * 100) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  )
}
