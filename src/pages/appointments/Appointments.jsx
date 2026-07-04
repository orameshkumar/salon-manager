import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  scheduled: 'badge-blue',
  completed: 'badge-green',
  cancelled: 'badge-red',
  'no-show':  'badge-yellow',
}

const STATUSES  = ['scheduled', 'completed', 'cancelled', 'no-show']
const EMPTY     = { customerName: '', customerPhone: '', service: '', stylist: '', stationId: '', date: '', time: '', notes: '' }

export default function Appointments() {
  const { docs: appointments, loading } = useCollection('appointments', 'date')
  const { docs: employees }             = useCollection('employees', 'name')
  const { docs: services }              = useCollection('services', 'name')
  const { docs: stations }              = useCollection('stations', 'name')

  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter]     = useState('all')

  // Filter staff by selected service; show all active staff if no service chosen or staff has no services list
  const allStaff = employees.filter((e) => e.active !== false)
  const stylists = form.service
    ? allStaff.filter((e) => !e.services?.length || e.services.includes(form.service))
    : allStaff
  const serviceNames = services.length > 0
    ? services.map((s) => s.name)
    : ['Haircut', 'Hair colour', 'Blowdry', 'Facial', 'Manicure', 'Pedicure', 'Threading', 'Waxing', 'Massage']

  const filtered = appointments.filter((a) => filter === 'all' ? true : a.status === filter)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
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

      const station = stations.find((s) => s.id === form.stationId)
      const apptData = {
        ...form,
        stationName: station?.name || null,
        date: Timestamp.fromDate(dateTime),
      }
      if (editDoc) {
        await updateDoc(doc(db, 'appointments', editDoc.id), { ...apptData, updatedAt: serverTimestamp() })
        toast.success('Appointment updated')
      } else {
        // Auto-create customer if not exists (check by phone, fallback to name)
        try {
          let existing = null
          if (form.customerPhone) {
            const snap = await getDocs(
              query(collection(db, 'customers'), where('phone', '==', form.customerPhone.trim()))
            )
            existing = snap.empty ? null : snap.docs[0]
          }
          if (!existing && form.customerName) {
            const snap = await getDocs(
              query(collection(db, 'customers'), where('name', '==', form.customerName.trim()))
            )
            existing = snap.empty ? null : snap.docs[0]
          }
          if (!existing) {
            await addDoc(collection(db, 'customers'), {
              name:          form.customerName.trim(),
              phone:         form.customerPhone.trim(),
              email:         '',
              allergies:     '',
              loyaltyPoints: 0,
              totalVisits:   0,
              createdAt:     serverTimestamp(),
            })
          }
        } catch (custErr) {
          console.error('Customer auto-create failed:', custErr)
        }

        await addDoc(collection(db, 'appointments'), {
          ...apptData,
          status: 'scheduled',
          createdAt: serverTimestamp(),
        })
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
      toast.success('Status updated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete appointment for ${a.customerName}?`)) return
    setDeleting(a.id)
    try {
      await deleteDoc(doc(db, 'appointments', a.id))
      toast.success('Appointment deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} total`}
        action={<button className="btn-primary" onClick={openAdd}>+ Book appointment</button>}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'scheduled', 'completed', 'cancelled', 'no-show'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Form */}
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
              <select className="input" required value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value, stylist: '' })}>
                <option value="">Select service</option>
                {serviceNames.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stylist
                {form.service && stylists.length < allStaff.length && (
                  <span className="text-gray-400 font-normal ml-1">(filtered by service)</span>
                )}
              </label>
              <select className="input" value={form.stylist}
                onChange={(e) => setForm({ ...form, stylist: e.target.value })}>
                <option value="">Any available</option>
                {stylists.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
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
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input className="input" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update' : 'Book appointment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
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
                    <select
                      value={a.status}
                      onChange={(ev) => handleStatusChange(a, ev.target.value)}
                      className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(a)}>Edit</button>
                      <button
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        disabled={deleting === a.id}
                        onClick={() => handleDelete(a)}
                      >
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
      )}
    </div>
  )
}
