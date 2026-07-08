import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

const STATUSES = ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show']

const BOARD_COLS = [
  { key: 'scheduled',   label: 'Scheduled',   color: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   next: 'in-progress', nextLabel: '▶ Start' },
  { key: 'in-progress', label: 'In Progress',  color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', next: 'completed',   nextLabel: '✓ Done'  },
  { key: 'completed',   label: 'Completed',    color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', next: null,          nextLabel: null      },
]

const WAIT_STATUSES = ['waiting', 'called', 'seated', 'left']

const EMPTY = { customerName: '', customerPhone: '', service: '', stylist: '', stationId: '', date: '', time: '', notes: '' }
const WAIT_EMPTY = { customerName: '', customerPhone: '', service: '', stylistPref: '', estimatedWait: '15', notes: '' }

// ── Board view ──────────────────────────────────────────────────────────────
function BoardView({ appointments, onStatusChange }) {
  const others = appointments.filter((a) => a.status === 'cancelled' || a.status === 'no-show')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {BOARD_COLS.map((col) => {
          const cards = appointments.filter((a) => a.status === col.key)
          return (
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${col.badge}`}>{col.label}</span>
                <span className="text-xs text-gray-400">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4 italic">Empty</p>
                )}
                {cards.map((a) => (
                  <div key={a.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <p className="font-medium text-sm text-gray-900">{a.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.service}</p>
                    {a.stylist && <p className="text-xs text-gray-400">{a.stylist}</p>}
                    <p className="text-xs text-gray-400">
                      {a.date?.toDate ? format(a.date.toDate(), 'h:mm a') : '—'}
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {col.next && (
                        <button
                          onClick={() => onStatusChange(a, col.next)}
                          className="px-2 py-1 bg-brand-600 text-white rounded text-xs hover:bg-brand-700 transition-colors"
                        >
                          {col.nextLabel}
                        </button>
                      )}
                      {col.key !== 'scheduled' && (
                        <button
                          onClick={() => onStatusChange(a, col.key === 'completed' ? 'in-progress' : 'scheduled')}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
                        >
                          ← Back
                        </button>
                      )}
                      <button
                        onClick={() => onStatusChange(a, 'cancelled')}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {others.length > 0 && (
        <div className="card">
          <p className="text-xs font-medium text-gray-500 mb-2">Cancelled / No-show ({others.length})</p>
          <div className="flex flex-wrap gap-2">
            {others.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                <span>{a.customerName}</span>
                <span className="text-gray-400">·</span>
                <span>{a.service}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Waiting list ─────────────────────────────────────────────────────────────
const BASE_URL = window.location.origin + '/salon-manager'

function QRModal({ entry, onClose }) {
  const qrUrl = `${BASE_URL}/queue/${entry.id}`
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(qrUrl, { width: 200, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => {})
  }, [qrUrl])

  function printTicket() {
    const w = window.open('', '_blank', 'width=320,height=520')
    w.document.write(`<!DOCTYPE html><html><head><title>Queue — ${entry.customerName}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px;max-width:280px;margin:0 auto}
      h2{font-size:16px;margin-bottom:4px}p{font-size:12px;color:#555;margin:4px 0}
      img{margin:12px auto;display:block}
      @media print{@page{size:80mm auto;margin:8mm}}</style></head>
      <body>
        <h2>${entry.customerName}</h2>
        <p>${entry.service || 'Walk-in'}${entry.stylistPref ? ' · ' + entry.stylistPref : ''}</p>
        <p>Scan to track your queue position</p>
        ${dataUrl ? `<img src="${dataUrl}" width="200" height="200"/>` : ''}
        <p style="font-size:9px;color:#999;word-break:break-all;margin-top:8px;">${qrUrl}</p>
        <script>window.onload=function(){window.print()}<\/script>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-0.5">Queue ticket</p>
        <p className="text-xs text-gray-500 mb-4">{entry.customerName} — scan to track position</p>
        <div className="flex justify-center mb-3">
          {dataUrl
            ? <img src={dataUrl} alt="Queue QR code" className="rounded-lg" width={200} height={200} />
            : <div className="w-[200px] h-[200px] bg-gray-100 rounded-lg animate-pulse" />}
        </div>
        <p className="text-xs text-gray-400 break-all mb-4">{qrUrl}</p>
        <div className="flex gap-2 justify-center">
          <button className="btn-secondary text-sm" onClick={onClose}>Close</button>
          <button className="btn-primary text-sm" disabled={!dataUrl} onClick={printTicket}>
            🖨 Print ticket
          </button>
        </div>
      </div>
    </div>
  )
}

function WaitingList({ serviceNames, allStaff }) {
  const { docs: waitList, loading } = useCollection('waitingList', 'addedAt')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(WAIT_EMPTY)
  const [saving, setSaving]       = useState(false)
  const [qrEntry, setQrEntry]     = useState(null)

  const active = waitList.filter((w) => w.status === 'waiting' || w.status === 'called')
  const done   = waitList.filter((w) => w.status === 'seated' || w.status === 'left')

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.customerName.trim()) { toast.error('Customer name required'); return }
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'waitingList'), {
        ...form,
        estimatedWait: Number(form.estimatedWait) || 15,
        status: 'waiting',
        addedAt: serverTimestamp(),
      })
      toast.success('Added to waiting list')
      setForm(WAIT_EMPTY)
      setShowForm(false)
      setQrEntry({ id: ref.id, ...form, status: 'waiting' })
    } catch { toast.error('Failed to add') } finally { setSaving(false) }
  }

  async function setStatus(id, status) {
    try {
      await updateDoc(doc(db, 'waitingList', id), { status, updatedAt: serverTimestamp() })
    } catch { toast.error('Failed to update') }
  }

  async function remove(id) {
    try {
      await deleteDoc(doc(db, 'waitingList', id))
    } catch { toast.error('Failed to remove') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-semibold text-gray-800">Waiting List</p>
          <p className="text-xs text-gray-500">{active.length} currently waiting</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm((p) => !p)}>
          {showForm ? 'Cancel' : '+ Add to waitlist'}
        </button>
      </div>

      {showForm && (
        <div className="card border-brand-200">
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer name *</label>
              <input className="input" required value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input className="input" value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service</label>
              <select className="input" value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}>
                <option value="">Any / walk-in</option>
                {serviceNames.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Preferred stylist</label>
              <select className="input" value={form.stylistPref}
                onChange={(e) => setForm({ ...form, stylistPref: e.target.value })}>
                <option value="">Any available</option>
                {allStaff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Est. wait (minutes)</label>
              <input className="input" type="number" min="0" value={form.estimatedWait}
                onChange={(e) => setForm({ ...form, estimatedWait: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input className="input" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add to waitlist'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <>
          {active.length === 0 && !showForm && (
            <div className="card text-center py-8 text-gray-400 text-sm">No one currently waiting</div>
          )}
          {active.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['#', 'Customer', 'Service', 'Stylist', 'Est. wait', 'Added', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {active.map((w, i) => (
                      <tr key={w.id} className={w.status === 'called' ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 font-bold text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{w.customerName}</p>
                          {w.customerPhone && <p className="text-xs text-gray-400">{w.customerPhone}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{w.service || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{w.stylistPref || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{w.estimatedWait} min</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {w.addedAt?.toDate ? format(w.addedAt.toDate(), 'h:mm a') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            w.status === 'called' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>{w.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {w.status === 'waiting' && (
                              <button className="text-xs text-amber-600 hover:underline font-medium"
                                onClick={() => setStatus(w.id, 'called')}>📣 Call</button>
                            )}
                            {w.status === 'called' && (
                              <button className="text-xs text-green-600 hover:underline font-medium"
                                onClick={() => setStatus(w.id, 'seated')}>✓ Seated</button>
                            )}
                            <button className="text-xs text-brand-600 hover:underline font-medium"
                              onClick={() => setQrEntry(w)}>📲 QR</button>
                            <button className="text-xs text-gray-500 hover:underline"
                              onClick={() => setStatus(w.id, 'left')}>Left</button>
                            <button className="text-xs text-red-500 hover:underline"
                              onClick={() => remove(w.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {done.length > 0 && (
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer select-none hover:text-gray-600">
                Show {done.length} completed/left entries
              </summary>
              <div className="mt-2 space-y-1 pl-2">
                {done.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-gray-400">
                    <span>{w.customerName}</span>
                    <span>·</span>
                    <span>{w.service || 'walk-in'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${w.status === 'seated' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                      {w.status}
                    </span>
                    <button className="text-red-400 hover:text-red-600 ml-auto" onClick={() => remove(w.id)}>✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {qrEntry && <QRModal entry={qrEntry} onClose={() => setQrEntry(null)} />}
    </div>
  )
}

// ── Main Appointments page ───────────────────────────────────────────────────
export default function Appointments() {
  const { docs: appointments, loading } = useCollection('appointments', 'date')
  const { docs: employees }             = useCollection('employees', 'name')
  const { docs: services }              = useCollection('services', 'name')
  const { docs: stations }              = useCollection('stations', 'name')
  const { docs: leaveRecords }          = useCollection('staffLeave')

  const [view, setView]         = useState('list')   // 'list' | 'board' | 'waiting'
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter]     = useState('all')

  const allStaff   = employees.filter((e) => e.active !== false)
  const stylists   = form.service
    ? allStaff.filter((e) => !e.services?.length || e.services.includes(form.service))
    : allStaff
  const serviceNames = services.map((s) => s.name)

  const filtered = appointments.filter((a) => filter === 'all' ? true : a.status === filter)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
    if (view === 'waiting') setView('list')
  }

  function openEdit(a) {
    setEditDoc(a)
    const d = a.date?.toDate?.()
    setForm({
      customerName:  a.customerName,
      customerPhone: a.customerPhone,
      service:       a.service,
      stylist:       a.stylist || '',
      stationId:     a.stationId || '',
      date:          d ? format(d, 'yyyy-MM-dd') : '',
      time:          d ? format(d, 'HH:mm') : '',
      notes:         a.notes || '',
    })
    setShowForm(true)
    setView('list')
  }

  function closeForm() {
    setShowForm(false)
    setEditDoc(null)
    setForm(EMPTY)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const dateTime = new Date(`${form.date}T${form.time}`)
      const station  = stations.find((s) => s.id === form.stationId)
      const apptData = { ...form, stationName: station?.name || null, date: Timestamp.fromDate(dateTime) }

      if (editDoc) {
        await updateDoc(doc(db, 'appointments', editDoc.id), { ...apptData, updatedAt: serverTimestamp() })
        toast.success('Appointment updated')
      } else {
        try {
          let existing = null
          if (form.customerPhone) {
            const snap = await getDocs(query(collection(db, 'customers'), where('phone', '==', form.customerPhone.trim())))
            existing = snap.empty ? null : snap.docs[0]
          }
          if (!existing && form.customerName) {
            const snap = await getDocs(query(collection(db, 'customers'), where('name', '==', form.customerName.trim())))
            existing = snap.empty ? null : snap.docs[0]
          }
          if (!existing) {
            await addDoc(collection(db, 'customers'), {
              name: form.customerName.trim(), phone: form.customerPhone.trim(),
              email: '', allergies: '', loyaltyPoints: 0, totalVisits: 0, createdAt: serverTimestamp(),
            })
          }
        } catch {}
        await addDoc(collection(db, 'appointments'), { ...apptData, status: 'scheduled', createdAt: serverTimestamp() })
        toast.success('Appointment booked')
      }
      closeForm()
    } catch {
      toast.error('Failed to save appointment')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(a, status) {
    try {
      await updateDoc(doc(db, 'appointments', a.id), { status, updatedAt: serverTimestamp() })
      if (status !== 'cancelled') toast.success(`Moved to ${status}`)
    } catch { toast.error('Failed to update status') }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete appointment for ${a.customerName}?`)) return
    setDeleting(a.id)
    try {
      await deleteDoc(doc(db, 'appointments', a.id))
      toast.success('Appointment deleted')
    } catch { toast.error('Failed to delete') } finally { setDeleting(null) }
  }

  const VIEWS = [
    { key: 'list',    label: '☰ List'    },
    { key: 'board',   label: '⊞ Board'   },
    { key: 'waiting', label: '⏳ Waiting' },
  ]

  return (
    <div className="p-6">
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} total`}
        action={<button className="btn-primary" onClick={openAdd}>+ Book appointment</button>}
      />

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {VIEWS.map(({ key, label }) => (
            <button key={key} onClick={() => { setView(key); setShowForm(false) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Status filter — only for list view */}
        {view === 'list' && (
          <div className="flex gap-1.5 flex-wrap">
            {['all', ...STATUSES].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Book / Edit form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.customerName}` : 'Book appointment'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer name *</label>
              <input className="input" required value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
              <input className="input" required value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service *</label>
              {serviceNames.length === 0
                ? <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">No services configured.</p>
                : <select className="input" required value={form.service}
                    onChange={(e) => setForm({ ...form, service: e.target.value, stylist: '' })}>
                    <option value="">Select service</option>
                    {serviceNames.map((s) => <option key={s}>{s}</option>)}
                  </select>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stylist
                {form.service && stylists.length < allStaff.length && (
                  <span className="text-gray-400 font-normal ml-1">(filtered)</span>
                )}
              </label>
              <select className="input" value={form.stylist}
                onChange={(e) => setForm({ ...form, stylist: e.target.value })}>
                <option value="">Any available</option>
                {stylists.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            {/* Leave warning */}
            {form.stylist && form.date && leaveRecords.some((l) =>
              l.status === 'approved' && l.staffName === form.stylist &&
              l.startDate <= form.date && l.endDate >= form.date
            ) && (
              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 font-medium">
                ⚠️ {form.stylist} has approved leave on {form.date}. Consider reassigning.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Station</label>
              <select className="input" value={form.stationId}
                onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
                <option value="">No station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.assignedStaffName ? ` — ${s.assignedStaffName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input className="input" type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Time *</label>
              <input className="input" type="time" required value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input className="input" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update' : 'Book appointment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Views */}
      {view === 'waiting' && (
        <WaitingList serviceNames={serviceNames} allStaff={allStaff} />
      )}

      {view === 'board' && !loading && (
        <BoardView appointments={appointments} onStatusChange={handleStatusChange} />
      )}

      {view === 'list' && (
        loading ? <p className="text-sm text-gray-500">Loading…</p> : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Customer', 'Phone', 'Service', 'Stylist', 'Station', 'Date & time', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No appointments found</td></tr>
                  )}
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.customerName}</td>
                      <td className="px-4 py-3 text-gray-600">{a.customerPhone}</td>
                      <td className="px-4 py-3 text-gray-600">{a.service}</td>
                      <td className="px-4 py-3 text-gray-600">{a.stylist || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.stationName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {a.date?.toDate ? format(a.date.toDate(), 'dd MMM, h:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select value={a.status}
                          onChange={(ev) => handleStatusChange(a, ev.target.value)}
                          className="input text-sm py-1.5 w-auto">
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(a)}>Edit</button>
                          <button className="text-xs text-red-600 hover:underline disabled:opacity-50"
                            disabled={deleting === a.id} onClick={() => handleDelete(a)}>
                            {deleting === a.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
