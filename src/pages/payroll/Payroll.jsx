import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format, getDaysInMonth, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_EDIT = { baseSalary: '', bonus: '', deductions: '', absenceDays: '', notes: '', paid: false }

// ── Formula modal ─────────────────────────────────────────────────────────────
function FormulaModal({ month, activeStaff, onConfirm, onClose }) {
  const [year, mon] = month.split('-').map(Number)
  const calendarDays  = getDaysInMonth(new Date(year, mon - 1))
  const autoWorking   = eachDayOfInterval({
    start: startOfMonth(new Date(year, mon - 1)),
    end:   endOfMonth(new Date(year, mon - 1)),
  }).filter((d) => !isWeekend(d)).length

  const [formula, setFormula] = useState({
    workingDays:   String(autoWorking),
    absentDeduct:  'full',
    halfDayDeduct: 'half',
    leaveDeduct:   'none',
    useAttendance: true,
  })

  const absentFactor  = { full: 1, half: 0.5, none: 0 }[formula.absentDeduct]
  const halfDayFactor = { half: 0.5, none: 0 }[formula.halfDayDeduct]
  const leaveFactor   = { none: 0, full: 1 }[formula.leaveDeduct]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Salary generation — {month}</p>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Working days in month</label>
              <input className="input" type="number" min="1" max={calendarDays}
                value={formula.workingDays}
                onChange={(e) => setFormula({ ...formula, workingDays: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">
                {autoWorking} weekdays · {calendarDays} calendar days
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formula.useAttendance}
                  onChange={(e) => setFormula({ ...formula, useAttendance: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-sm text-gray-700">Apply attendance deductions</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">Reads Attendance records for {month}</p>
            </div>
          </div>

          {formula.useAttendance && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-amber-800">Deduction rules</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Absent day</label>
                  <select className="input text-xs" value={formula.absentDeduct}
                    onChange={(e) => setFormula({ ...formula, absentDeduct: e.target.value })}>
                    <option value="full">Deduct 1 full day</option>
                    <option value="half">Deduct half day</option>
                    <option value="none">No deduction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Half-day</label>
                  <select className="input text-xs" value={formula.halfDayDeduct}
                    onChange={(e) => setFormula({ ...formula, halfDayDeduct: e.target.value })}>
                    <option value="half">Deduct half day</option>
                    <option value="none">No deduction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Leave day</label>
                  <select className="input text-xs" value={formula.leaveDeduct}
                    onChange={(e) => setFormula({ ...formula, leaveDeduct: e.target.value })}>
                    <option value="none">No deduction (paid)</option>
                    <option value="full">Deduct 1 day (unpaid)</option>
                  </select>
                </div>
              </div>

              <div className="p-2 bg-white rounded border border-amber-200 text-xs">
                <p className="font-medium text-gray-600 mb-1">Formula: Day rate = Base salary ÷ {formula.workingDays || '?'}</p>
                <p className="text-gray-700 font-mono">
                  Deduction = {[
                    absentFactor  > 0 && `absent × ${absentFactor} × dayRate`,
                    halfDayFactor > 0 && `half-days × ${halfDayFactor} × dayRate`,
                    leaveFactor   > 0 && `leaves × ${leaveFactor} × dayRate`,
                  ].filter(Boolean).join(' + ') || '0 (no deductions)'}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Generating for <span className="font-medium">{activeStaff.length} staff</span> with base salary set.
            You can edit every field individually after generation.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onConfirm({
            workingDays:   Number(formula.workingDays) || autoWorking,
            useAttendance: formula.useAttendance,
            absentFactor,
            halfDayFactor,
            leaveFactor,
          })}>
            Generate salaries
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Payroll() {
  const { docs: employees }          = useCollection('employees', 'name')
  const { docs: salaries, loading }  = useCollection('salaries')

  const [month, setMonth]           = useState(format(new Date(), 'yyyy-MM'))
  const [showFormula, setShowFormula] = useState(false)
  const [generating, setGen]        = useState(false)
  const [editDoc, setEditDoc]       = useState(null)
  const [editForm, setEditForm]     = useState(EMPTY_EDIT)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(null)

  const activeStaff   = employees.filter((e) => e.active !== false && e.baseSalary)
  const monthSalaries = salaries.filter((s) => s.month === month)
  const totalPayable  = monthSalaries.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalPaid     = monthSalaries.filter((r) => r.paid).reduce((s, r) => s + (r.total ?? 0), 0)

  async function fetchAttendanceSummary(targetMonth) {
    const [year, mon] = targetMonth.split('-').map(Number)
    const monthStart = startOfMonth(new Date(year, mon - 1))
    const monthEnd   = endOfMonth(new Date(year, mon - 1))
    const snap = await getDocs(
      query(collection(db, 'attendance'),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd))
    )
    const summary = {}
    for (const d of snap.docs) {
      const rec = d.data()
      if (!rec.employeeId) continue
      if (!summary[rec.employeeId]) summary[rec.employeeId] = { absent: 0, halfDay: 0, leave: 0 }
      if (rec.status === 'absent')   summary[rec.employeeId].absent++
      if (rec.status === 'half-day') summary[rec.employeeId].halfDay++
      if (rec.status === 'leave')    summary[rec.employeeId].leave++
    }
    return summary
  }

  async function handleGenerate(formula) {
    setShowFormula(false)
    if (!activeStaff.length) { toast.error('No active staff with base salary set'); return }
    setGen(true)
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'salaries'), where('month', '==', month))
      )
      const existingIds = new Set(existingSnap.docs.map((d) => d.data().employeeId))
      const toAdd = activeStaff.filter((e) => !existingIds.has(e.id))
      if (!toAdd.length) { toast.success('Salaries already generated for this month'); return }

      const attendance = formula.useAttendance ? await fetchAttendanceSummary(month) : {}

      await Promise.all(toAdd.map((e) => {
        const base    = e.baseSalary ?? 0
        const att     = attendance[e.id] ?? { absent: 0, halfDay: 0, leave: 0 }
        const dayRate = formula.workingDays > 0 ? base / formula.workingDays : 0
        const absenceDeduction = formula.useAttendance
          ? Math.round(
              att.absent  * formula.absentFactor  * dayRate +
              att.halfDay * formula.halfDayFactor  * dayRate +
              att.leave   * formula.leaveFactor    * dayRate
            )
          : 0
        const absenceDays = formula.useAttendance
          ? att.absent * formula.absentFactor +
            att.halfDay * formula.halfDayFactor +
            att.leave   * formula.leaveFactor
          : 0

        return addDoc(collection(db, 'salaries'), {
          employeeId:   e.id,
          employeeName: e.name,
          month,
          baseSalary:   base,
          bonus:        0,
          deductions:   absenceDeduction,
          absenceDays,
          absenceBreakdown: formula.useAttendance ? att : null,
          workingDays:  formula.workingDays,
          total:        Math.max(0, base - absenceDeduction),
          paid:         false,
          createdAt:    serverTimestamp(),
        })
      }))
      toast.success(`Generated ${toAdd.length} salary record${toAdd.length > 1 ? 's' : ''}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate salaries')
    } finally {
      setGen(false)
    }
  }

  function openEdit(rec) {
    setEditDoc(rec)
    setEditForm({
      baseSalary:  rec.baseSalary  ?? 0,
      bonus:       rec.bonus       ?? 0,
      deductions:  rec.deductions  ?? 0,
      absenceDays: rec.absenceDays ?? 0,
      notes:       rec.notes       ?? '',
      paid:        rec.paid        ?? false,
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const baseSalary = Number(editForm.baseSalary)
      const bonus      = Number(editForm.bonus)
      const deductions = Number(editForm.deductions)
      const total      = Math.max(0, baseSalary + bonus - deductions)
      await updateDoc(doc(db, 'salaries', editDoc.id), {
        baseSalary, bonus, deductions, total,
        absenceDays: Number(editForm.absenceDays),
        notes:       editForm.notes,
        paid:        editForm.paid,
        paidAt:      editForm.paid ? serverTimestamp() : null,
        updatedAt:   serverTimestamp(),
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
      {showFormula && (
        <FormulaModal
          month={month}
          activeStaff={activeStaff}
          onConfirm={handleGenerate}
          onClose={() => setShowFormula(false)}
        />
      )}

      <PageHeader
        title="Payroll"
        subtitle={`${month} · ₹${totalPaid.toLocaleString()} paid of ₹${totalPayable.toLocaleString()}`}
        action={
          <button className="btn-primary" onClick={() => setShowFormula(true)} disabled={generating}>
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
            { label: 'Total payable', val: `₹${totalPayable.toLocaleString()}`,               color: 'text-gray-800' },
            { label: 'Paid',          val: `₹${totalPaid.toLocaleString()}`,                   color: 'text-green-600' },
            { label: 'Pending',       val: `₹${(totalPayable - totalPaid).toLocaleString()}`,  color: 'text-amber-600' },
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
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base salary (₹)</label>
              <input className="input" type="number" min="0" value={editForm.baseSalary}
                onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bonus (₹)</label>
              <input className="input" type="number" min="0" value={editForm.bonus}
                onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Deductions (₹) <span className="text-gray-400 font-normal">incl. absence</span>
              </label>
              <input className="input" type="number" min="0" value={editForm.deductions}
                onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Absence days</label>
              <input className="input" type="number" min="0" step="0.5" value={editForm.absenceDays}
                onChange={(e) => setEditForm({ ...editForm, absenceDays: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Net payable</label>
              <input className="input bg-gray-50 font-semibold" disabled
                value={`₹${Math.max(0, Number(editForm.baseSalary) + Number(editForm.bonus) - Number(editForm.deductions)).toLocaleString()}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input className="input" placeholder="e.g. Diwali bonus" value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={editForm.paid}
                  onChange={(e) => setEditForm({ ...editForm, paid: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand-600" />
                Mark as paid
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditDoc(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Update record'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Salary table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Base', 'Absent days', 'Bonus', 'Deductions', 'Net payable', 'Notes', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthSalaries.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm">
                    No salary records for {month}. Click "Generate salaries" to create them.
                  </td></tr>
                )}
                {monthSalaries.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">{rec.employeeName}</td>
                    <td className="px-3 py-3 text-gray-600">₹{(rec.baseSalary ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {(rec.absenceDays ?? 0) > 0
                        ? <span className="badge-red">{rec.absenceDays} days</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-green-600">+₹{(rec.bonus ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-red-500">−₹{(rec.deductions ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">₹{(rec.total ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs">{rec.notes || '—'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => togglePaid(rec)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${rec.paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {rec.paid ? 'Paid' : 'Pending'}
                      </button>
                    </td>
                    <td className="px-3 py-3">
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
