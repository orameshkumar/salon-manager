import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

const EMPTY = { name: '', phone: '', email: '', allergies: '' }

export default function Customers() {
  const { docs: customers, loading } = useCollection('customers', 'name')
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  const filtered = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(c) {
    setEditDoc(c)
    setForm({ name: c.name, phone: c.phone, email: c.email || '', allergies: c.allergies || '' })
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
      if (editDoc) {
        await updateDoc(doc(db, 'customers', editDoc.id), {
          ...form,
          updatedAt: serverTimestamp(),
        })
        toast.success('Customer updated')
      } else {
        await addDoc(collection(db, 'customers'), {
          ...form,
          loyaltyPoints: 0,
          totalVisits: 0,
          createdAt: serverTimestamp(),
        })
        toast.success('Customer added')
      }
      closeForm()
    } catch {
      toast.error('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return
    setDeleting(c.id)
    try {
      await deleteDoc(doc(db, 'customers', c.id))
      toast.success('Customer deleted')
    } catch {
      toast.error('Failed to delete customer')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} total`}
        action={
          <button className="btn-primary" onClick={openAdd}>
            + New customer
          </button>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.name}` : 'New customer'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
              <input className="input" required value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Allergies / notes</label>
              <input className="input" value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update customer' : 'Save customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Phone', 'Email', 'Visits', 'Points', 'Allergies', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No customers found</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.totalVisits ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="badge-green">{c.loyaltyPoints ?? 0} pts</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.allergies ? <span className="badge-red">{c.allergies}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(c)}>Edit</button>
                      <button
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        disabled={deleting === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        {deleting === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
