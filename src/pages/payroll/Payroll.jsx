import { useState, useMemo } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, where, getDocs,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format, getDaysInMonth, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_EDIT = { baseSalary: '', bonus: '', deductions: '', absenceDays: '', notes: '', paid: false }

// ── Formula + staff-selection modal ──────────────────────────────────────────
function GenerateModal({ activeStaff, existingIds, month, onConfirm, onClose }) {
  const [year, mon] = month.split('-').map(Number)
  const monthStart     = startOfMonth(new Date(year, mon - 1))
  const monthEnd       = endOfMonth(new Date(year, mon - 1))
  const calendarDays   = getDaysInMonth(new Date(year, mon - 1))
  const autoWorking    = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => !isWeekend(d)).length

  const defaultFrom = format(monthStart, 'yyyy-MM-dd')
  const defaultTo   = format(monthEnd,   'yyyy-MM-dd')

  // Staff not yet generated for this month
  const eligible = activeStaff.filter((e) => !existingIds.has(e.id))

  const [dateFrom,      setDateFrom]      = useState(defaultFrom)
  const [dateTo,        setDateTo]        = useState(defaultTo)
  const [selectedIds,   setSelectedIds]   = useState(() => new Set(eligible.map((e) => e.id)))
  const [workingDays,   setWorkingDays]   = useState(String(autoWorking))
  const [useAttendance, setUseAttendance] = useState(true)
  const [absentDeduct,  setAbsentDeduct]  = useState('full')
  const [halfDayDeduct, setHalfDayDeduct] = useState('half')
  const [leaveDeduct,   setLeaveDeduct]   = useState('none')

  const absentFactor  = { full: 1, half: 0.5, none: 0 }[absentDeduct]
  const halfDayFactor = { half: 0.5, none: 0 }[halfDayDeduct]
  const leaveFactor   = { none: 0, full: 1 }[leaveDeduct]

  const allSelected = eligible.length > 0 && selectedIds.size === eligible.length
  const someSelected = selectedIds.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(eligible.map((e) => e.id)))
  }

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (selectedIds.size === 0) { toast.error('Select at least one staff member'); return }
    if (!dateFrom || !dateTo)   { toast.error('Set a valid date range'); return }
    if (dateFrom > dateTo)      { toast.error('From date must be before To date'); return }
    onConfirm({
      staffIds:      [...selectedIds],
      dateFrom,
      dateTo,
      workingDays:   Number(workingDays) || autoWorking,
      useAttendance,
      absentFactor,
      halfDayFactor,
      leaveFactor,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className="text-sm font-semibold text-gray-800">Generate salaries — {month}</p>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Date range */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Attendance period</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payroll-period-from" className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input id="payroll-period-from" type="date" className="input" value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label htmlFor="payroll-period-to" className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input id="payroll-period-to" type="date" className="input" value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Attendance records in this range are used to calculate deductions.
            </p>
          </div>

          {/* Staff selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Select staff</p>
              <span className="text-xs text-gray-400">{selectedIds.size} of {eligible.length} selected</span>
            </div>

            {eligible.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {activeStaff.length === 0
                  ? 'No staff have a base salary configured. Go to Staff → edit each member → set Base salary.'
                  : `All active staff already have salary records for ${month}.`}
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Select all row */}
                <label className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-brand-600"
                  />
                  <span className="text-xs font-semibold text-gray-700">Select all</span>
                </label>
                {/* Individual rows */}
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-100">
                  {eligible.map((emp) => (
                    <label key={emp.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleOne(emp.id)}
                          className="w-4 h-4 rounded accent-brand-600"
                        />
                        <span className="text-sm text-gray-800">{emp.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        ₹{(emp.baseSalary ?? 0).toLocaleString()} / {emp.salaryType ?? 'monthly'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Working days + attendance toggle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="payroll-working-days" className="block text-xs font-medium text-gray-700 mb-1">Working days</label>
              <input id="payroll-working-days" className="input" type="number" min="1" max={calendarDays}
                value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">{autoWorking} weekdays · {calendarDays} calendar days</p>
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useAttendance}
                  onChange={(e) => setUseAttendance(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600" />
                <span className="text-sm text-gray-700">Apply attendance deductions</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Reads records from {dateFrom} → {dateTo}
              </p>
            </div>
          </div>

          {/* Deduction rules */}
          {useAttendance && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-amber-800">Deduction rules</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="deduct-absent" className="block text-xs font-medium text-gray-700 mb-1">Absent day</label>
                  <select id="deduct-absent" className="input text-xs" value={absentDeduct} onChange={(e) => setAbsentDeduct(e.target.value)}>
                    <option value="full">Deduct 1 full day</option>
                    <option value="half">Deduct half day</option>
                    <option value="none">No deduction</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="deduct-halfday" className="block text-xs font-medium text-gray-700 mb-1">Half-day</label>
                  <select id="deduct-halfday" className="input text-xs" value={halfDayDeduct} onChange={(e) => setHalfDayDeduct(e.target.value)}>
                    <option value="half">Deduct half day</option>
                    <option value="none">No deduction</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="deduct-leave" className="block text-xs font-medium text-gray-700 mb-1">Leave day</label>
                  <select id="deduct-leave" className="input text-xs" value={leaveDeduct} onChange={(e) => setLeaveDeduct(e.target.value)}>
                    <option value="none">No deduction (paid)</option>
                    <option value="full">Deduct 1 day (unpaid)</option>
                  </select>
                </div>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200 text-xs">
                <p className="font-medium text-gray-600 mb-1">
                  Day rate = Base salary ÷ {workingDays || '?'}
                </p>
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
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 gap-3">
          <p className="text-xs text-gray-500">
            Will generate <span className="font-medium">{selectedIds.size}</span> record{selectedIds.size !== 1 ? 's' : ''}.
            Each can be edited individually after.
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Generate {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Payroll() {
  const { docs: employees }          = useCollection('employees', 'name')
  const { docs: salaries, loading }  = useCollection('salaries')

  const [month, setMonth]             = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal]     = useState(false)
  const [generating, setGen]          = useState(false)
  const [editDoc, setEditDoc]         = useState(null)
  const [editForm, setEditForm]       = useState(EMPTY_EDIT)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(null)

  const activeStaff   = employees.filter((e) => e.active !== false && e.baseSalary)
  const monthSalaries = salaries.filter((s) => s.month === month)
  const existingIds   = useMemo(() => new Set(monthSalaries.map((s) => s.employeeId)), [monthSalaries])

  const totalPayable  = monthSalaries.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalPaid     = monthSalaries.filter((r) => r.paid).reduce((s, r) => s + (r.total ?? 0), 0)

  async function fetchAttendanceSummary(dateFrom, dateTo) {
    const fromTs = new Date(dateFrom + 'T00:00:00')
    const toTs   = new Date(dateTo   + 'T23:59:59')
    const snap = await getDocs(
      query(collection(db, 'attendance'),
        where('date', '>=', fromTs),
        where('date', '<=', toTs))
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

  async function handleGenerate(opts) {
    setShowModal(false)
    setGen(true)
    try {
      const staffToGen = activeStaff.filter((e) => opts.staffIds.includes(e.id))
      if (!staffToGen.length) { toast.error('No staff selected'); return }

      const attendance = opts.useAttendance
        ? await fetchAttendanceSummary(opts.dateFrom, opts.dateTo)
        : {}

      await Promise.all(staffToGen.map((e) => {
        const base    = e.baseSalary ?? 0
        const att     = attendance[e.id] ?? { absent: 0, halfDay: 0, leave: 0 }
        const dayRate = opts.workingDays > 0 ? base / opts.workingDays : 0
        const absenceDeduction = opts.useAttendance
          ? Math.round(
              att.absent  * opts.absentFactor  * dayRate +
              att.halfDay * opts.halfDayFactor  * dayRate +
              att.leave   * opts.leaveFactor    * dayRate
            )
          : 0
        const absenceDays = opts.useAttendance
          ? att.absent  * opts.absentFactor +
            att.halfDay * opts.halfDayFactor +
            att.leave   * opts.leaveFactor
          : 0

        return addDoc(collection(db, 'salaries'), {
          employeeId:       e.id,
          employeeName:     e.name,
          month,
          periodFrom:       opts.dateFrom,
          periodTo:         opts.dateTo,
          baseSalary:       base,
          bonus:            0,
          deductions:       absenceDeduction,
          absenceDays,
          absenceBreakdown: opts.useAttendance ? att : null,
          workingDays:      opts.workingDays,
          total:            Math.max(0, base - absenceDeduction),
          paid:             false,
          createdAt:        serverTimestamp(),
        })
      }))

      toast.success(`Generated ${staffToGen.length} salary record${staffToGen.length > 1 ? 's' : ''}`)
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
      {showModal && (
        <GenerateModal
          month={month}
          activeStaff={activeStaff}
          existingIds={existingIds}
          onConfirm={handleGenerate}
          onClose={() => setShowModal(false)}
        />
      )}

      <PageHeader
        title="Payroll"
        subtitle={`${month} · ₹${totalPaid.toLocaleString()} paid of ₹${totalPayable.toLocaleString()}`}
        action={
          <button className="btn-primary" onClick={() => setShowModal(true)} disabled={generating || loading}>
            {generating ? 'Generating…' : 'Generate salaries'}
          </button>
        }
      />

      {/* Month picker + summary */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input type="month" className="input w-full sm:w-44" aria-label="Payroll month" value={month}
          onChange={(e) => setMonth(e.target.value)} />
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total payable', val: `₹${totalPayable.toLocaleString()}`,              color: 'text-gray-800' },
            { label: 'Paid',          val: `₹${totalPaid.toLocaleString()}`,                  color: 'text-green-600' },
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
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sal-base" className="block text-xs font-medium text-gray-700 mb-1">Base salary (₹)</label>
              <input id="sal-base" className="input" type="number" min="0" value={editForm.baseSalary}
                onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sal-bonus" className="block text-xs font-medium text-gray-700 mb-1">Bonus (₹)</label>
              <input id="sal-bonus" className="input" type="number" min="0" value={editForm.bonus}
                onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sal-deductions" className="block text-xs font-medium text-gray-700 mb-1">
                Deductions (₹) <span className="text-gray-400 font-normal">incl. absence</span>
              </label>
              <input id="sal-deductions" className="input" type="number" min="0" value={editForm.deductions}
                onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sal-absence-days" className="block text-xs font-medium text-gray-700 mb-1">Absence days</label>
              <input id="sal-absence-days" className="input" type="number" min="0" step="0.5" value={editForm.absenceDays}
                onChange={(e) => setEditForm({ ...editForm, absenceDays: e.target.value })} />
            </div>
            <div>
              <label htmlFor="sal-net" className="block text-xs font-medium text-gray-700 mb-1">Net payable</label>
              <input id="sal-net" className="input bg-gray-50 font-semibold" disabled
                value={`₹${Math.max(0, Number(editForm.baseSalary) + Number(editForm.bonus) - Number(editForm.deductions)).toLocaleString()}`} />
            </div>
            <div>
              <label htmlFor="sal-notes" className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input id="sal-notes" className="input" placeholder="e.g. Diwali bonus" value={editForm.notes}
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
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Period', 'Base', 'Absent', 'Bonus', 'Deductions', 'Net payable', 'Notes', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthSalaries.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm">
                    No salary records for {month}. Click "Generate salaries" to create them.
                  </td></tr>
                )}
                {monthSalaries.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">{rec.employeeName}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {rec.periodFrom && rec.periodTo
                        ? `${rec.periodFrom} → ${rec.periodTo}`
                        : rec.month}
                    </td>
                    <td className="px-3 py-3 text-gray-600">₹{(rec.baseSalary ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {(rec.absenceDays ?? 0) > 0
                        ? <span className="badge-red">{rec.absenceDays}d</span>
                        : <span className="text-gray-300">—</span>}
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
