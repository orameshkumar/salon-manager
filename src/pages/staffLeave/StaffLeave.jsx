import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

const LEAVE_TYPES = ['planned', 'sick', 'emergency', 'other']
const LEAVE_STATUS = ['pending', 'approved', 'rejected']

const EMPTY = {
  staffId: '', staffName: '', startDate: '', endDate: '',
  leaveType: 'planned', reason: '', status: 'approved',
}

export default function StaffLeave() {
  const { docs: leaves,    loading }  = useCollection('staffLeave', 'startDate')
  const { docs: employees }           = useCollection('employees', 'name')

  const [showForm, setShowForm]   = useState(false)
  const [editDoc, setEditDoc]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [filterStaff, setFilter]  = useState('all')
  const [filterStatus, setFStatus] = useState('all')

  const activeStaff = employees.filter((e) => e.active !== false)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(l) {
    setEditDoc(l)
    setForm({
      staffId:   l.staffId   || '',
      staffName: l.staffName || '',
      startDate: l.startDate || '',
      endDate:   l.endDate   || '',
      leaveType: l.leaveType || 'planned',
      reason:    l.reason    || '',
      status:    l.status    || 'approved',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditDoc(null)
    setForm(EMPTY)
  }

  function pickStaff(id) {
    const emp = activeStaff.find((e) => e.id === id)
    setForm((p) => ({ ...p, staffId: id, staffName: emp?.name || '' }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.staffId)    { toast.error('Select a staff member'); return }
    if (!form.startDate)  { toast.error('Start date required'); return }
    if (!form.endDate)    { toast.error('End date required'); return }
    if (form.endDate < form.startDate) { toast.error('End date must be on or after start date'); return }

    setSaving(true)
    try {
      const payload = { ...form, updatedAt: serverTimestamp() }
      if (editDoc) {
        await updateDoc(doc(db, 'staffLeave', editDoc.id), payload)
        toast.success('Leave updated')
      } else {
        await addDoc(collection(db, 'staffLeave'), { ...payload, createdAt: serverTimestamp() })
        toast.success('Leave recorded')
      }
      closeForm()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleApprove(l, status) {
    try {
      await updateDoc(doc(db, 'staffLeave', l.id), { status, updatedAt: serverTimestamp() })
      toast.success(`Leave ${status}`)
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete(l) {
    if (!window.confirm(`Delete leave for ${l.staffName}?`)) return
    setDeleting(l.id)
    try {
      await deleteDoc(doc(db, 'staffLeave', l.id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') } finally { setDeleting(null) }
  }

  const filtered = leaves.filter((l) => {
    if (filterStaff !== 'all' && l.staffId !== filterStaff) return false
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    return true
  })

  // Summary: who is on leave today
  const today = format(new Date(), 'yyyy-MM-dd')
  const onLeaveToday = leaves.filter((l) =>
    l.status === 'approved' && l.startDate <= today && l.endDate >= today
  )

  const STATUS_COLOR = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const TYPE_COLOR = {
    planned:   'bg-blue-100 text-blue-700',
    sick:      'bg-orange-100 text-orange-700',
    emergency: 'bg-red-100 text-red-700',
    other:     'bg-gray-100 text-gray-600',
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Staff Leave"
        subtitle={`${leaves.length} total records`}
        action={<button className="btn-primary" onClick={openAdd}>+ Record leave</button>}
      />

      {/* Today banner */}
      {onLeaveToday.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-800 mb-1">On leave today</p>
          <div className="flex flex-wrap gap-2">
            {onLeaveToday.map((l) => (
              <span key={l.id} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">
                {l.staffName} <span className="opacity-60">({l.leaveType})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit leave — ${editDoc.staffName}` : 'Record leave'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="leave-staff" className="block text-xs font-medium text-gray-700 mb-1">Staff member *</label>
              <select id="leave-staff" className="input" required value={form.staffId} onChange={(e) => pickStaff(e.target.value)}>
                <option value="">Select staff</option>
                {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="leave-type" className="block text-xs font-medium text-gray-700 mb-1">Leave type</label>
              <select id="leave-type" className="input" value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="leave-start" className="block text-xs font-medium text-gray-700 mb-1">Start date *</label>
              <input id="leave-start" className="input" type="date" required value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="leave-end" className="block text-xs font-medium text-gray-700 mb-1">End date *</label>
              <input id="leave-end" className="input" type="date" required value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label htmlFor="leave-status" className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select id="leave-status" className="input" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {LEAVE_STATUS.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="leave-reason" className="block text-xs font-medium text-gray-700 mb-1">Reason / notes</label>
              <input id="leave-reason" className="input" placeholder="Optional" value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update' : 'Record leave'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <select className="input w-auto py-1.5 text-sm"
          value={filterStaff} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All staff</option>
          {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {['all', ...LEAVE_STATUS].map((s) => (
            <button key={s} onClick={() => setFStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Staff', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No leave records found</td></tr>
                )}
                {filtered.map((l) => {
                  const start = l.startDate ? parseISO(l.startDate) : null
                  const end   = l.endDate   ? parseISO(l.endDate)   : null
                  const days  = start && end
                    ? Math.round((end - start) / 86400000) + 1
                    : '—'

                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.staffName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLOR[l.leaveType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {l.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {start ? format(start, 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {end ? format(end, 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{days}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{l.reason || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[l.status] ?? 'bg-gray-100'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {l.status === 'pending' && (
                            <>
                              <button className="text-xs text-green-600 hover:underline font-medium"
                                onClick={() => handleApprove(l, 'approved')}>Approve</button>
                              <button className="text-xs text-red-600 hover:underline"
                                onClick={() => handleApprove(l, 'rejected')}>Reject</button>
                            </>
                          )}
                          <button className="text-xs text-blue-600 hover:underline"
                            onClick={() => openEdit(l)}>Edit</button>
                          <button className="text-xs text-red-600 hover:underline disabled:opacity-50"
                            disabled={deleting === l.id}
                            onClick={() => handleDelete(l)}>
                            {deleting === l.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper exported for use in Appointments booking — check if a stylist is on approved leave for a given date
export function isOnLeave(staffName, dateStr, leaves) {
  return leaves.some((l) =>
    l.status === 'approved' &&
    l.staffName === staffName &&
    l.startDate <= dateStr &&
    l.endDate   >= dateStr
  )
}
