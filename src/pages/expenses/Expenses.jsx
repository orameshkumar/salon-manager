import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EXPENSE_TYPES = ['Rent', 'Utility', 'Purchase', 'Salary', 'Other']

const EMPTY = {
  type:        'Rent',
  description: '',
  amount:      '',
  date:        format(new Date(), 'yyyy-MM-dd'),
  vendor:      '',
  notes:       '',
}

const TYPE_COLORS = {
  Rent:     'bg-blue-100 text-blue-700',
  Utility:  'bg-amber-100 text-amber-700',
  Purchase: 'bg-green-100 text-green-700',
  Salary:   'bg-purple-100 text-purple-700',
  Other:    'bg-gray-100 text-gray-600',
}

export default function Expenses() {
  const { docs: expenses, loading } = useCollection('expenses')

  const [showForm, setShowForm] = useState(false)
  const [editDoc,  setEditDoc]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter,   setFilter]   = useState('All')

  const totalAll = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const byType   = EXPENSE_TYPES.reduce((acc, t) => {
    acc[t] = expenses.filter((e) => e.type === t).reduce((s, e) => s + (e.amount ?? 0), 0)
    return acc
  }, {})

  const filtered = filter === 'All' ? expenses : expenses.filter((e) => e.type === filter)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(exp) {
    setEditDoc(exp)
    setForm({
      type:        exp.type,
      description: exp.description ?? '',
      amount:      exp.amount ?? '',
      date:        exp.date ?? format(new Date(), 'yyyy-MM-dd'),
      vendor:      exp.vendor ?? '',
      notes:       exp.notes ?? '',
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
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      const data = {
        type:        form.type,
        description: form.description.trim(),
        amount:      Number(form.amount),
        date:        form.date,
        vendor:      form.vendor.trim(),
        notes:       form.notes.trim(),
      }
      if (editDoc) {
        await updateDoc(doc(db, 'expenses', editDoc.id), { ...data, updatedAt: serverTimestamp() })
        toast.success('Expense updated')
      } else {
        await addDoc(collection(db, 'expenses'), { ...data, createdAt: serverTimestamp() })
        toast.success('Expense recorded')
      }
      closeForm()
    } catch {
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(exp) {
    if (!window.confirm(`Delete this ${exp.type} expense of ₹${exp.amount}?`)) return
    setDeleting(exp.id)
    try {
      await deleteDoc(doc(db, 'expenses', exp.id))
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Expenses"
        subtitle={`Total recorded: ₹${totalAll.toLocaleString()}`}
        action={<button className="btn-primary" onClick={openAdd}>+ Add expense</button>}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {EXPENSE_TYPES.map((t) => (
          <div key={t} className="card py-3 px-4">
            <p className="text-xs text-gray-500 mb-1">{t}</p>
            <p className="text-lg font-semibold text-gray-800">₹{(byType[t] ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['All', ...EXPENSE_TYPES].map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? 'Edit expense' : 'Add expense'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exp-type" className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
              <select id="exp-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {EXPENSE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) *</label>
              <input id="exp-amount" className="input" type="number" min="0" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label htmlFor="exp-description" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input id="exp-description" className="input" placeholder="e.g. June electricity bill" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input id="exp-date" className="input" type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label htmlFor="exp-vendor" className="block text-xs font-medium text-gray-700 mb-1">Vendor / Payee</label>
              <input id="exp-vendor" className="input" placeholder="e.g. EB Office, Landlord" value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div>
              <label htmlFor="exp-notes" className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input id="exp-notes" className="input" placeholder="Any extra notes" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update expense' : 'Add expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Type', 'Description', 'Vendor', 'Amount', 'Notes', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No expenses recorded</td></tr>
                )}
                {filtered
                  .slice()
                  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
                  .map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 text-xs">{exp.date || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[exp.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {exp.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{exp.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{exp.vendor || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{(exp.amount ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{exp.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(exp)}>Edit</button>
                        <button className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === exp.id} onClick={() => handleDelete(exp)}>
                          {deleting === exp.id ? '…' : 'Delete'}
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
