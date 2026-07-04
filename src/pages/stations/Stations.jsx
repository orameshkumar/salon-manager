import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

const EMPTY = { name: '', description: '', assignedStaffId: '' }

export default function Stations() {
  const { docs: stations, loading } = useCollection('stations', 'name')
  const { docs: employees }         = useCollection('employees', 'name')

  const [showForm, setShowForm] = useState(false)
  const [editDoc,  setEditDoc]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const activeStaff = employees.filter((e) => e.active !== false)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(s) {
    setEditDoc(s)
    setForm({ name: s.name, description: s.description || '', assignedStaffId: s.assignedStaffId || '' })
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
      const assignedStaff = activeStaff.find((emp) => emp.id === form.assignedStaffId)
      const payload = {
        name:              form.name.trim(),
        description:       form.description.trim(),
        assignedStaffId:   form.assignedStaffId || null,
        assignedStaffName: assignedStaff?.name || null,
      }
      if (editDoc) {
        await updateDoc(doc(db, 'stations', editDoc.id), { ...payload, updatedAt: serverTimestamp() })
        toast.success('Station updated')
      } else {
        await addDoc(collection(db, 'stations'), { ...payload, createdAt: serverTimestamp() })
        toast.success('Station added')
      }
      closeForm()
    } catch {
      toast.error('Failed to save station')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Delete station "${s.name}"?`)) return
    setDeleting(s.id)
    try {
      await deleteDoc(doc(db, 'stations', s.id))
      toast.success('Station deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Stations"
        subtitle={`${stations.length} station${stations.length !== 1 ? 's' : ''}`}
        action={<button className="btn-primary" onClick={openAdd}>+ Add station</button>}
      />

      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.name}` : 'Add station'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Station name / number *</label>
              <input className="input" required placeholder="e.g. Chair 1, Station A"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned staff</label>
              <select className="input" value={form.assignedStaffId}
                onChange={(e) => setForm({ ...form, assignedStaffId: e.target.value })}>
                <option value="">Unassigned</option>
                {activeStaff.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description / notes</label>
              <input className="input" placeholder="e.g. Hair only, near window…"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update station' : 'Add station'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Station', 'Description', 'Assigned staff', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stations.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No stations added yet</td></tr>
              )}
              {stations.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.description || '—'}</td>
                  <td className="px-4 py-3">
                    {s.assignedStaffName
                      ? <span className="badge-green">{s.assignedStaffName}</span>
                      : <span className="text-gray-400 text-xs">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(s)}>Edit</button>
                      <button
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        disabled={deleting === s.id}
                        onClick={() => handleDelete(s)}
                      >
                        {deleting === s.id ? '…' : 'Delete'}
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
