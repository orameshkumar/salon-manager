import { useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Body', 'Other']
const COMMISSION_TYPES = [{ value: 'percentage', label: 'Percentage (%)' }, { value: 'fixed', label: 'Fixed (₹)' }]

// ── Category default rule ─────────────────────────────────────────────────────
function CategoryRules({ rules, employees, services }) {
  const catRules = rules.filter((r) => r.type === 'category')
  const [form, setForm] = useState({ category: '', commissionType: 'percentage', commissionValue: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  function openEdit(r) {
    setEditId(r.id)
    setForm({ category: r.category, commissionType: r.commissionType, commissionValue: r.commissionValue })
  }

  function reset() { setEditId(null); setForm({ category: '', commissionType: 'percentage', commissionValue: '' }) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.category || form.commissionValue === '') { toast.error('Fill all fields'); return }
    setSaving(true)
    try {
      const data = { type: 'category', category: form.category, commissionType: form.commissionType, commissionValue: Number(form.commissionValue) }
      if (editId) {
        await updateDoc(doc(db, 'commissionRules', editId), { ...data, updatedAt: serverTimestamp() })
        toast.success('Rule updated')
      } else {
        const exists = catRules.find((r) => r.category === form.category)
        if (exists) { toast.error(`A rule for ${form.category} already exists — edit it instead`); setSaving(false); return }
        await addDoc(collection(db, 'commissionRules'), { ...data, createdAt: serverTimestamp() })
        toast.success('Category rule added')
      }
      reset()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete category rule for ${r.category}?`)) return
    await deleteDoc(doc(db, 'commissionRules', r.id))
    toast.success('Deleted')
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-800 mb-1">Category defaults</p>
      <p className="text-xs text-gray-500 mb-4">Fallback commission for all services in a category when no per-service or staff override is set.</p>

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor="cat-rule-category" className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
          <select id="cat-rule-category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={!!editId}>
            <option value="">Select</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cat-rule-type" className="block text-xs font-medium text-gray-700 mb-1">Commission type *</label>
          <select id="cat-rule-type" className="input" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
            {COMMISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cat-rule-value" className="block text-xs font-medium text-gray-700 mb-1">
            {form.commissionType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'} *
          </label>
          <input id="cat-rule-value" className="input" type="number" min="0" max={form.commissionType === 'percentage' ? 100 : undefined}
            value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} />
        </div>
        <div className="sm:col-span-3 flex gap-2 justify-end">
          {editId && <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update rule' : '+ Add category rule'}
          </button>
        </div>
      </form>

      {catRules.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Category', 'Commission', 'Actions'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {catRules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.category}</td>
                  <td className="px-3 py-2">
                    <span className={r.commissionType === 'percentage' ? 'badge-blue' : 'badge-green'}>
                      {r.commissionType === 'percentage' ? `${r.commissionValue}%` : `₹${r.commissionValue}`}
                    </span>
                  </td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(r)}>Delete</button>
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

// ── Staff-specific overrides ──────────────────────────────────────────────────
function StaffOverrides({ rules, employees, services }) {
  const overrides = rules.filter((r) => r.type === 'staff-override')
  const EMPTY = { staffId: '', scope: 'service', serviceName: '', category: '', commissionType: 'percentage', commissionValue: '' }
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  function openEdit(r) {
    setEditId(r.id)
    setForm({ staffId: r.staffId, scope: r.scope, serviceName: r.serviceName ?? '', category: r.category ?? '', commissionType: r.commissionType, commissionValue: r.commissionValue })
  }
  function reset() { setEditId(null); setForm(EMPTY) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.staffId) { toast.error('Select a staff member'); return }
    if (form.scope === 'service' && !form.serviceName) { toast.error('Select a service'); return }
    if (form.scope === 'category' && !form.category) { toast.error('Select a category'); return }
    if (form.commissionValue === '') { toast.error('Enter commission value'); return }
    setSaving(true)
    try {
      const staff = employees.find((e) => e.id === form.staffId)
      const data = {
        type: 'staff-override',
        staffId: form.staffId,
        staffName: staff?.name ?? '',
        scope: form.scope,
        serviceName: form.scope === 'service' ? form.serviceName : null,
        category: form.scope === 'category' ? form.category : null,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue),
      }
      if (editId) {
        await updateDoc(doc(db, 'commissionRules', editId), { ...data, updatedAt: serverTimestamp() })
        toast.success('Override updated')
      } else {
        await addDoc(collection(db, 'commissionRules'), { ...data, createdAt: serverTimestamp() })
        toast.success('Staff override added')
      }
      reset()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleDelete(r) {
    if (!window.confirm('Delete this staff override?')) return
    await deleteDoc(doc(db, 'commissionRules', r.id))
    toast.success('Deleted')
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-800 mb-1">Staff-specific overrides</p>
      <p className="text-xs text-gray-500 mb-4">Override the default commission for a specific staff member — by service or by category. Takes priority over all other rules.</p>

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor="override-staff" className="block text-xs font-medium text-gray-700 mb-1">Staff member *</label>
          <select id="override-staff" className="input" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} disabled={!!editId}>
            <option value="">Select staff</option>
            {employees.filter((e) => e.active !== false).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="override-scope" className="block text-xs font-medium text-gray-700 mb-1">Override scope *</label>
          <select id="override-scope" className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, serviceName: '', category: '' })}>
            <option value="service">Specific service</option>
            <option value="category">Service category</option>
          </select>
        </div>
        {form.scope === 'service' ? (
          <div>
            <label htmlFor="override-service" className="block text-xs font-medium text-gray-700 mb-1">Service *</label>
            <select id="override-service" className="input" value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })}>
              <option value="">Select service</option>
              {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="override-category" className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
            <select id="override-category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="override-commission-type" className="block text-xs font-medium text-gray-700 mb-1">Commission type *</label>
          <select id="override-commission-type" className="input" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
            {COMMISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="override-commission-value" className="block text-xs font-medium text-gray-700 mb-1">
            {form.commissionType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'} *
          </label>
          <input id="override-commission-value" className="input" type="number" min="0" max={form.commissionType === 'percentage' ? 100 : undefined}
            value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-1 flex gap-2 items-end">
          {editId && <button type="button" className="btn-secondary w-full" onClick={reset}>Cancel</button>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update' : '+ Add override'}
          </button>
        </div>
      </form>

      {overrides.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Staff', 'Applies to', 'Commission', 'Actions'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {overrides.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.staffName}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {r.scope === 'service'
                      ? <span><span className="badge-blue mr-1">Service</span>{r.serviceName}</span>
                      : <span><span className="badge-green mr-1">Category</span>{r.category}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.commissionType === 'percentage' ? 'badge-blue' : 'badge-green'}>
                      {r.commissionType === 'percentage' ? `${r.commissionValue}%` : `₹${r.commissionValue}`}
                    </span>
                  </td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(r)}>Delete</button>
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

// ── Monthly target bonuses ────────────────────────────────────────────────────
function MonthlyTargets({ rules, employees }) {
  const targets = rules.filter((r) => r.type === 'monthly-target')
  const EMPTY = { staffId: 'all', targetType: 'services', targetValue: '', bonusType: 'fixed', bonusValue: '', description: '' }
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  function openEdit(r) {
    setEditId(r.id)
    setForm({ staffId: r.staffId, targetType: r.targetType, targetValue: r.targetValue, bonusType: r.bonusType, bonusValue: r.bonusValue, description: r.description ?? '' })
  }
  function reset() { setEditId(null); setForm(EMPTY) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.targetValue || !form.bonusValue) { toast.error('Fill all fields'); return }
    setSaving(true)
    try {
      const staff = employees.find((emp) => emp.id === form.staffId)
      const data = {
        type: 'monthly-target',
        staffId: form.staffId,
        staffName: form.staffId === 'all' ? 'All staff' : (staff?.name ?? ''),
        targetType: form.targetType,
        targetValue: Number(form.targetValue),
        bonusType: form.bonusType,
        bonusValue: Number(form.bonusValue),
        description: form.description.trim(),
      }
      if (editId) {
        await updateDoc(doc(db, 'commissionRules', editId), { ...data, updatedAt: serverTimestamp() })
        toast.success('Target updated')
      } else {
        await addDoc(collection(db, 'commissionRules'), { ...data, createdAt: serverTimestamp() })
        toast.success('Target bonus added')
      }
      reset()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleDelete(r) {
    if (!window.confirm('Delete this target bonus rule?')) return
    await deleteDoc(doc(db, 'commissionRules', r.id))
    toast.success('Deleted')
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-800 mb-1">Monthly target bonuses</p>
      <p className="text-xs text-gray-500 mb-4">Pay a bonus when a staff member hits a monthly service count or revenue target. Applied during payroll.</p>

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor="target-staff" className="block text-xs font-medium text-gray-700 mb-1">Applies to</label>
          <select id="target-staff" className="input" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
            <option value="all">All staff</option>
            {employees.filter((e) => e.active !== false).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target-metric" className="block text-xs font-medium text-gray-700 mb-1">Target metric *</label>
          <select id="target-metric" className="input" value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })}>
            <option value="services">Services completed (count)</option>
            <option value="revenue">Revenue generated (₹)</option>
          </select>
        </div>
        <div>
          <label htmlFor="target-value" className="block text-xs font-medium text-gray-700 mb-1">
            {form.targetType === 'services' ? 'Target count *' : 'Target revenue (₹) *'}
          </label>
          <input id="target-value" className="input" type="number" min="1" placeholder={form.targetType === 'services' ? 'e.g. 50' : 'e.g. 50000'}
            value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />
        </div>
        <div>
          <label htmlFor="target-bonus-type" className="block text-xs font-medium text-gray-700 mb-1">Bonus type *</label>
          <select id="target-bonus-type" className="input" value={form.bonusType} onChange={(e) => setForm({ ...form, bonusType: e.target.value })}>
            <option value="fixed">Fixed amount (₹)</option>
            <option value="percentage">% of monthly revenue</option>
          </select>
        </div>
        <div>
          <label htmlFor="target-bonus-value" className="block text-xs font-medium text-gray-700 mb-1">
            {form.bonusType === 'fixed' ? 'Bonus amount (₹) *' : 'Bonus % of revenue *'}
          </label>
          <input id="target-bonus-value" className="input" type="number" min="0" placeholder={form.bonusType === 'fixed' ? 'e.g. 2000' : 'e.g. 5'}
            value={form.bonusValue} onChange={(e) => setForm({ ...form, bonusValue: e.target.value })} />
        </div>
        <div>
          <label htmlFor="target-description" className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input id="target-description" className="input" placeholder="e.g. Senior stylist target" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
          {editId && <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update target' : '+ Add target bonus'}
          </button>
        </div>
      </form>

      {targets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Staff', 'Target', 'Bonus', 'Description', 'Actions'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {targets.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.staffName}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {r.targetType === 'services'
                      ? `${r.targetValue} services/month`
                      : `₹${Number(r.targetValue).toLocaleString()} revenue/month`}
                  </td>
                  <td className="px-3 py-2">
                    <span className="badge-green">
                      {r.bonusType === 'fixed' ? `₹${r.bonusValue}` : `${r.bonusValue}% of revenue`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{r.description || '—'}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(r)}>Edit</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(r)}>Delete</button>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommissionRules() {
  const { docs: rules, loading } = useCollection('commissionRules')
  const { docs: employees }      = useCollection('employees', 'name')
  const { docs: services }       = useCollection('services', 'name')

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Commission Rules"
        subtitle="Define how staff bonuses are calculated — priority: staff override → per-service → category default"
      />

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Rule priority (highest → lowest):</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
          <li>Staff override — specific service or category for that staff member</li>
          <li>Per-service rate — set on the individual service (in the Services page)</li>
          <li>Category default — fallback rate for all services in that category</li>
          <li>No commission</li>
        </ol>
      </div>

      <CategoryRules rules={rules} employees={employees} services={services} />
      <StaffOverrides rules={rules} employees={employees} services={services} />
      <MonthlyTargets rules={rules} employees={employees} />
    </div>
  )
}
