import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_EDIT = { bonus: '', deductions: '', notes: '', paid: false }

export default function Payroll() {
  const { docs: employees }           = useCollection('employees', 'name')
  const { docs: salaries, loading }   = useCollection('salaries')

  const [month, setMonth]       = useState(format(new Date(), 'yyyy-MM'))
  const [generating, setGen]    = useState(false)
  const [editDoc, setEditDoc]   = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  const activeStaff    = employees.filter((e) => e.active !== false && e.baseSalary)
  const monthSalaries  = salaries.filter((s) => s.month === month)
  const totalPayable   = monthSalaries.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalPaid      = monthSalaries.filter((r) => r.paid).reduce((s, r) => s + (r.total ?? 0), 0)

  async function generateSalaries() {
    if (!activeStaff.length) { toast.error('No staff with base salary set'); return }
    setGen(true)
    try {
      const existing = await getDocs(query(collection(db, 'salaries'), where('month', '==', month)))
      const existingIds = new Set(existing.docs.map((d) => d.data().employeeId))
      const toAdd = activeStaff.filter((e) => !existingIds.has(e.id))
      if (!toAdd.length) { toast.success('Salaries already generated for this month'); setGen(false); return }
      await Promise.all(toAdd.map((e) =>
        addDoc(collection(db, 'salaries'), {
          employeeId:   e.id,
          employeeName: e.name,
          month,
          baseSalary:   e.baseSalary ?? 0,
          bonus:        0,
          deductions:   0,
          total:        e.baseSalary ?? 0,
          paid:         false,
          createdAt:    serverTimestamp(),
        })
      ))
      toast.success(`Generated ${toAdd.length} salary record${toAdd.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to generate salaries')
    } finally {
      setGen(false)
    }
  }

  function openEdit(rec) {
    setEditDoc(rec)
    setEditForm({ bonus: rec.bonus ?? 0, deductions: rec.deductions ?? 0, notes: rec.notes ?? '', paid: rec.paid ?? false })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const bonus      = Number(editForm.bonus)
      const deductions = Number(editForm.deductions)
      const total      = (editDoc.baseSalary ?? 0) + bonus - deductions
      await updateDoc(doc(db, 'salaries', editDoc.id), {
        bonus, deductions, total,
        notes:     editForm.notes,
        paid:      editForm.paid,
        paidAt:    editForm.paid ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      toast.success('Salary record updated')
      setEditDoc(null)
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rec) {
    if (!window.confirm(`Delete salary record for ${rec.employeeName}?`)) return
    setDeleting(rec.id)
    try {
      await deleteDoc(doc(db, 'salaries', rec.id))
      toast.success('Record deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  async function togglePaid(rec) {
    try {
      await updateDoc(doc(db, 'salaries', rec.id), {
        paid:      !rec.paid,
        paidAt:    !rec.paid ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      toast.success(rec.paid ? 'Marked unpaid' : 'Marked paid')
    } catch {
      toast.error('Failed to update')
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Payroll"
        subtitle={`${month} · ₹${totalPaid.toLocaleString()} paid of ₹${totalPayable.toLocaleString()}`}
        action={
          <button className="btn-primary" onClick={generateSalaries} disabled={generating}>
            {generating ? 'Generating…' : 'Generate salaries'}
          </button>
        }
      />

      {/* Month picker + summary */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input type="month" className="input w-full sm:w-44" value={month}
          onChange={(e) => setMonth(e.target.value)} />
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total payable', val: `₹${totalPayable.toLocaleString()}`, color: 'text-gray-800' },
            { label: 'Paid',          val: `₹${totalPaid.toLocaleString()}`,     color: 'text-green-600' },
            { label: 'Pending',       val: `₹${(totalPayable - totalPaid).toLocaleString()}`, color: 'text-amber-600' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card py-2 px-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-semibold ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {editDoc && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">Edit — {editDoc.employeeName}</p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base salary</label>
              <input className="input bg-gray-50" disabled value={`₹${editDoc.baseSalary ?? 0}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bonus (₹)</label>
              <input className="input" type="number" min="0" value={editForm.bonus}
                onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deductions (₹)</label>
              <input className="input" type="number" min="0" value={editForm.deductions}
                onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Net payable</label>
              <input className="input bg-gray-50 font-semibold" disabled
                value={`₹${((editDoc.baseSalary ?? 0) + Number(editForm.bonus) - Number(editForm.deductions)).toLocaleString()}`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input className="input" placeholder="e.g. Performance bonus" value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={editForm.paid}
                  onChange={(e) => setEditForm({ ...editForm, paid: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand-600" />
                Mark as paid
              </label>
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setEditDoc(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Update record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Salary table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Base salary', 'Bonus', 'Deductions', 'Net payable', 'Notes', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthSalaries.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                    No salary records for {month}. Click "Generate salaries" to create them.
                  </td></tr>
                )}
                {monthSalaries.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{rec.employeeName}</td>
                    <td className="px-4 py-3 text-gray-600">₹{(rec.baseSalary ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-600">+₹{(rec.bonus ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-500">-₹{(rec.deductions ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{(rec.total ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{rec.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePaid(rec)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${rec.paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {rec.paid ? 'Paid' : 'Pending'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(rec)}>Edit</button>
                        <button className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === rec.id} onClick={() => handleDelete(rec)}>
                          {deleting === rec.id ? '…' : 'Delete'}
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
