import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Body', 'Other']
const COMMISSION_TYPES = ['none', 'percentage', 'fixed']
const EMPTY = { name: '', category: '', price: '', duration: '', description: '', commissionType: 'none', commissionValue: '' }

const DEFAULT_SERVICES = [
  { name: 'Haircut',     category: 'Hair', price: 300,  duration: 30,  description: 'Basic haircut and styling' },
  { name: 'Hair colour', category: 'Hair', price: 1200, duration: 90,  description: 'Full hair colouring' },
  { name: 'Blowdry',    category: 'Hair', price: 400,  duration: 30,  description: 'Blowdry and finish' },
  { name: 'Facial',     category: 'Skin', price: 800,  duration: 60,  description: 'Deep cleansing facial' },
  { name: 'Manicure',   category: 'Nails', price: 500, duration: 45,  description: 'Nail shaping and polish' },
  { name: 'Pedicure',   category: 'Nails', price: 600, duration: 45,  description: 'Foot care and nail polish' },
  { name: 'Threading',  category: 'Skin', price: 100,  duration: 15,  description: 'Eyebrow threading' },
  { name: 'Waxing',     category: 'Body', price: 700,  duration: 45,  description: 'Full body waxing' },
  { name: 'Massage',    category: 'Body', price: 1500, duration: 60,  description: 'Relaxing body massage' },
]

export default function Services() {
  const { docs: services, loading } = useCollection('services', 'name')
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter]     = useState('all')
  const [seeding, setSeeding]   = useState(false)

  async function loadDefaults() {
    if (!window.confirm('This will add missing default services (skips duplicates). Continue?')) return
    setSeeding(true)
    try {
      const existingNames = new Set(services.map((s) => s.name.toLowerCase()))
      const toAdd = DEFAULT_SERVICES.filter((s) => !existingNames.has(s.name.toLowerCase()))

      if (toAdd.length === 0) {
        toast.success('All default services already exist — nothing to add')
        setSeeding(false)
        return
      }

      await Promise.all(
        toAdd.map((s) =>
          addDoc(collection(db, 'services'), { ...s, active: true, createdAt: serverTimestamp() })
        )
      )
      const skipped = DEFAULT_SERVICES.length - toAdd.length
      toast.success(`Added ${toAdd.length} service${toAdd.length > 1 ? 's' : ''}${skipped > 0 ? ` · ${skipped} already existed` : ''}`)
    } catch {
      toast.error('Failed to load defaults')
    } finally {
      setSeeding(false)
    }
  }

  const filtered = filter === 'all' ? services : services.filter((s) => s.category === filter)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(s) {
    setEditDoc(s)
    setForm({
      name: s.name, category: s.category || '', price: s.price ?? '',
      duration: s.duration || '', description: s.description || '',
      commissionType: s.commissionType || 'none', commissionValue: s.commissionValue ?? '',
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
      const data = {
        ...form,
        price:           Number(form.price),
        duration:        Number(form.duration),
        commissionType:  form.commissionType,
        commissionValue: form.commissionType !== 'none' && form.commissionValue !== '' ? Number(form.commissionValue) : 0,
      }
      if (editDoc) {
        await updateDoc(doc(db, 'services', editDoc.id), { ...data, updatedAt: serverTimestamp() })
        toast.success('Service updated')
      } else {
        await addDoc(collection(db, 'services'), { ...data, active: true, createdAt: serverTimestamp() })
        toast.success('Service added')
      }
      closeForm()
    } catch {
      toast.error('Failed to save service')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Delete "${s.name}"?`)) return
    setDeleting(s.id)
    try {
      await deleteDoc(doc(db, 'services', s.id))
      toast.success('Service deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Services"
        subtitle={`${services.length} services`}
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={loadDefaults} disabled={seeding}>
              {seeding ? 'Loading…' : 'Load defaults'}
            </button>
            <button className="btn-primary" onClick={openAdd}>+ Add service</button>
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === c ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.name}` : 'Add new service'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service name *</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select className="input" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (₹) *</label>
              <input className="input" type="number" min="0" required value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input className="input" type="number" min="0" value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input className="input" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {/* Commission */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Staff commission type</label>
              <select className="input" value={form.commissionType}
                onChange={(e) => setForm({ ...form, commissionType: e.target.value, commissionValue: '' })}>
                <option value="none">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
            </div>
            {form.commissionType !== 'none' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {form.commissionType === 'percentage' ? 'Commission %' : 'Commission amount (₹)'}
                </label>
                <input className="input" type="number" min="0"
                  max={form.commissionType === 'percentage' ? 100 : undefined}
                  placeholder={form.commissionType === 'percentage' ? 'e.g. 30' : 'e.g. 100'}
                  value={form.commissionValue}
                  onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} />
              </div>
            )}
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update service' : 'Add service'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Service', 'Category', 'Price', 'Commission', 'Duration', 'Description', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No services found</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.category || '—'}</td>
                  <td className="px-4 py-3 font-medium text-brand-700">₹{s.price}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {!s.commissionType || s.commissionType === 'none'
                      ? <span className="text-gray-400">—</span>
                      : s.commissionType === 'percentage'
                        ? <span className="badge-blue">{s.commissionValue}%</span>
                        : <span className="badge-green">₹{s.commissionValue}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.duration ? `${s.duration} min` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.description || '—'}</td>
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
          </table></div>
        </div>
      )}
    </div>
  )
}
