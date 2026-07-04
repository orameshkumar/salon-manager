import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'
import toast from 'react-hot-toast'

const STATUSES   = ['present', 'absent', 'half-day', 'leave']
const STATUS_STYLE = {
  present:  'bg-green-50 text-green-700 border-green-200',
  absent:   'bg-red-50 text-red-700 border-red-200',
  'half-day': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  leave:    'bg-blue-50 text-blue-700 border-blue-200',
}
const BADGE = {
  present:  'badge-green',
  absent:   'badge-red',
  'half-day': 'badge-yellow',
  leave:    'badge-blue',
}

export default function Attendance() {
  const { docs: employees }          = useCollection('employees', 'name')
  const { docs: records, loading }   = useCollection('attendance', 'date')
  const [date, setDate]              = useState(format(new Date(), 'yyyy-MM-dd'))
  const [view, setView]              = useState('daily')   // 'daily' | 'monthly'
  const [monthDate, setMonthDate]    = useState(format(new Date(), 'yyyy-MM'))
  const [saving, setSaving]          = useState(false)
  const [deleting, setDeleting]      = useState(null)

  // Daily view
  const dayRecords  = records.filter(
    (r) => r.date?.toDate ? format(r.date.toDate(), 'yyyy-MM-dd') === date : false
  )
  const markedIds   = new Set(dayRecords.map((r) => r.employeeId))
  const present     = dayRecords.filter((r) => r.status === 'present').length
  const halfDay     = dayRecords.filter((r) => r.status === 'half-day').length
  const absent      = dayRecords.filter((r) => r.status === 'absent').length
  const onLeave     = dayRecords.filter((r) => r.status === 'leave').length

  // Monthly summary
  const [year, month] = monthDate.split('-').map(Number)
  const monthStart    = startOfMonth(new Date(year, month - 1))
  const monthEnd      = endOfMonth(new Date(year, month - 1))
  const workingDays   = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => !isWeekend(d)).length

  const monthRecords = records.filter((r) => {
    const d = r.date?.toDate?.()
    return d && format(d, 'yyyy-MM') === monthDate
  })

  function getMonthSummary(empId) {
    const emp = monthRecords.filter((r) => r.employeeId === empId)
    return {
      present:  emp.filter((r) => r.status === 'present').length,
      halfDay:  emp.filter((r) => r.status === 'half-day').length,
      absent:   emp.filter((r) => r.status === 'absent').length,
      leave:    emp.filter((r) => r.status === 'leave').length,
    }
  }

  async function markAttendance(emp, status) {
    if (markedIds.has(emp.id)) { toast.error('Already marked — use Edit to change'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'attendance'), {
        employeeId:   emp.id,
        employeeName: emp.name,
        date:         Timestamp.fromDate(new Date(date)),
        status,
        createdAt:    serverTimestamp(),
      })
      toast.success(`${emp.name} — ${status}`)
    } catch {
      toast.error('Failed to mark attendance')
    } finally {
      setSaving(false)
    }
  }

  async function editAttendance(record, newStatus) {
    try {
      await updateDoc(doc(db, 'attendance', record.id), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
      })
      toast.success('Attendance updated')
    } catch {
      toast.error('Failed to update')
    }
  }

  async function deleteAttendance(record) {
    if (!window.confirm(`Delete attendance record for ${record.employeeName}?`)) return
    setDeleting(record.id)
    try {
      await deleteDoc(doc(db, 'attendance', record.id))
      toast.success('Record deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  async function markAllPresent() {
    const unmarked = employees.filter((e) => !markedIds.has(e.id))
    if (!unmarked.length) { toast.success('All employees already marked'); return }
    setSaving(true)
    try {
      await Promise.all(unmarked.map((emp) =>
        addDoc(collection(db, 'attendance'), {
          employeeId: emp.id, employeeName: emp.name,
          date: Timestamp.fromDate(new Date(date)),
          status: 'present', createdAt: serverTimestamp(),
        })
      ))
      toast.success(`Marked ${unmarked.length} employees as present`)
    } catch {
      toast.error('Failed to mark attendance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Attendance"
        subtitle={view === 'daily'
          ? `${present} present · ${halfDay} half-day · ${absent} absent · ${onLeave} leave`
          : `${monthDate} — ${workingDays} working days`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setView(view === 'daily' ? 'monthly' : 'daily')}
              className="btn-secondary"
            >
              {view === 'daily' ? 'Monthly view' : 'Daily view'}
            </button>
            {view === 'daily' && (
              <button className="btn-primary" onClick={markAllPresent} disabled={saving}>
                Mark all present
              </button>
            )}
          </div>
        }
      />

      {/* Daily View */}
      {view === 'daily' && (
        <>
          {/* Date + summary */}
          <div className="flex items-center gap-4 mb-6">
            <input type="date" className="input w-full sm:w-44" value={date}
              onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-3">
              {[
                { label: 'Present',  val: present,  color: 'text-green-600' },
                { label: 'Half day', val: halfDay,   color: 'text-yellow-600' },
                { label: 'Absent',   val: absent,    color: 'text-red-600' },
                { label: 'Leave',    val: onLeave,   color: 'text-blue-600' },
                { label: 'Unmarked', val: employees.length - dayRecords.length, color: 'text-gray-500' },
              ].map(({ label, val, color }) => (
                <div key={label} className="card py-2 px-3 text-center min-w-[72px]">
                  <p className={`text-xl font-semibold ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Employee table */}
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee', 'Role', 'Status', 'Mark', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No employees found</td></tr>
                  )}
                  {employees.map((emp) => {
                    const record = dayRecords.find((r) => r.employeeId === emp.id)
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{emp.role}</td>
                        <td className="px-4 py-3">
                          {record
                            ? <span className={BADGE[record.status] ?? 'badge-blue'}>{record.status}</span>
                            : <span className="badge-yellow">unmarked</span>}
                        </td>
                        <td className="px-4 py-3">
                          {!record && (
                            <div className="flex gap-1">
                              {STATUSES.map((s) => (
                                <button key={s} disabled={saving} onClick={() => markAttendance(emp, s)}
                                  className={`px-2 py-1 text-xs border rounded transition-colors capitalize ${STATUS_STYLE[s]}`}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {record && (
                            <div className="flex items-center gap-2">
                              <select
                                value={record.status}
                                onChange={(e) => editAttendance(record, e.target.value)}
                                className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                              >
                                {STATUSES.map((s) => <option key={s}>{s}</option>)}
                              </select>
                              <button
                                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                disabled={deleting === record.id}
                                onClick={() => deleteAttendance(record)}
                              >
                                {deleting === record.id ? '…' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Monthly View */}
      {view === 'monthly' && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <input type="month" className="input w-full sm:w-44" value={monthDate}
              onChange={(e) => setMonthDate(e.target.value)} />
            <p className="text-xs text-gray-500">{workingDays} working days this month</p>
          </div>

          {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee', 'Role', 'Present', 'Half day', 'Absent', 'Leave', 'Attendance %'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No employees found</td></tr>
                  )}
                  {employees.map((emp) => {
                    const s   = getMonthSummary(emp.id)
                    const pct = workingDays > 0
                      ? Math.round(((s.present + s.halfDay * 0.5) / workingDays) * 100)
                      : 0
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{emp.role}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{s.present}</td>
                        <td className="px-4 py-3 text-yellow-600 font-medium">{s.halfDay}</td>
                        <td className="px-4 py-3 text-red-600 font-medium">{s.absent}</td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{s.leave}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {pct}%
                            </span>
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
        </>
      )}
    </div>
  )
}
