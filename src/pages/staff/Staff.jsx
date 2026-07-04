import { useState } from 'react'
import {
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

// Admin roles have full access; floor roles are staff-level
export const ADMIN_ROLES = ['owner', 'manager']
export const FLOOR_ROLES = ['stylist', 'beautician', 'nail technician', 'receptionist', 'trainee', 'helper']
export const ALL_ROLES   = [...ADMIN_ROLES, ...FLOOR_ROLES]

const EMPTY = { name: '', email: '', phone: '', role: 'stylist', password: '', services: [], stationId: '' }

const ROLE_COLORS = {
  owner:            'bg-purple-100 text-purple-700',
  manager:          'bg-blue-100   text-blue-700',
  stylist:          'bg-brand-100  text-brand-700',
  beautician:       'bg-pink-100   text-pink-700',
  'nail technician':'bg-rose-100   text-rose-700',
  receptionist:     'bg-teal-100   text-teal-700',
  trainee:          'bg-yellow-100 text-yellow-700',
  helper:           'bg-gray-100   text-gray-600',
}

// Creates a Firebase Auth user without signing out the current admin
async function createAuthUser(email, password) {
  const app = initializeApp(
    {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    },
    `secondary-${Date.now()}`
  )
  const secondaryAuth = getAuth(app)
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await secondaryAuth.signOut()
  return cred.user.uid
}

export default function Staff() {
  const { profile } = useAuth()
  const { docs: staff, loading }   = useCollection('employees', 'name')
  const { docs: serviceList }      = useCollection('services', 'name')
  const { docs: stations }         = useCollection('stations', 'name')

  const [showForm,  setShowForm]  = useState(false)
  const [editDoc,   setEditDoc]   = useState(null)   // {id, ...fields} when editing
  const [form,      setForm]      = useState(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [search,    setSearch]    = useState('')

  const isOwnerOrManager = ADMIN_ROLES.includes(profile?.role)

  const filtered = staff.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.role?.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(member) {
    setEditDoc(member)
    setForm({
      name: member.name, email: member.email, phone: member.phone,
      role: member.role, password: '',
      services: member.services || [],
      stationId: member.stationId || '',
    })
    setShowForm(true)
  }

  function toggleService(name) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(name)
        ? prev.services.filter((s) => s !== name)
        : [...prev.services, name],
    }))
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
        // Update Firestore only (cannot change Firebase Auth email/password from client)
        const station = stations.find((s) => s.id === form.stationId)
        await updateDoc(doc(db, 'employees', editDoc.id), {
          name:        form.name,
          phone:       form.phone,
          role:        form.role,
          services:    form.services,
          stationId:   form.stationId || null,
          stationName: station?.name || null,
          updatedAt:   serverTimestamp(),
        })
        toast.success('Staff member updated')
      } else {
        // Create Firebase Auth user then Firestore record
        if (form.password.length < 6) {
          toast.error('Password must be at least 6 characters')
          setSaving(false)
          return
        }
        const uid = await createAuthUser(form.email, form.password)
        const station = stations.find((s) => s.id === form.stationId)
        await setDoc(doc(db, 'employees', uid), {
          name:        form.name,
          email:       form.email,
          phone:       form.phone,
          role:        form.role,
          services:    form.services,
          stationId:   form.stationId || null,
          stationName: station?.name || null,
          active:      true,
          createdAt:   serverTimestamp(),
        })
        toast.success(`${form.name} added successfully`)
      }
      closeForm()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Email is already registered')
      } else {
        toast.error(err.message ?? 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(member) {
    try {
      await updateDoc(doc(db, 'employees', member.id), {
        active: !member.active,
        updatedAt: serverTimestamp(),
      })
      toast.success(member.active ? 'Staff member deactivated' : 'Staff member activated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Delete ${member.name}? This cannot be undone.`)) return
    setDeleting(member.id)
    try {
      await deleteDoc(doc(db, 'employees', member.id))
      toast.success(`${member.name} removed`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  const activeCount = staff.filter((s) => s.active !== false).length
  const byRole      = ALL_ROLES.reduce((acc, r) => {
    acc[r] = staff.filter((s) => s.role === r).length
    return acc
  }, {})

  return (
    <div className="p-6">
      <PageHeader
        title="Staff"
        subtitle={`${activeCount} active members`}
        action={
          isOwnerOrManager && (
            <button className="btn-primary" onClick={openAdd}>
              + Add staff
            </button>
          )
        }
      />

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="card text-center py-2 px-4 min-w-[80px]">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-semibold text-brand-700">{staff.length}</p>
        </div>
        {ALL_ROLES.filter((r) => byRole[r] > 0).map((r) => (
          <div key={r} className="card text-center py-2 px-4 min-w-[80px]">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 capitalize">{r}</p>
            <p className={`text-2xl font-semibold ${ROLE_COLORS[r]?.split(' ')[1] ?? 'text-gray-600'}`}>{byRole[r]}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search by name, email or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.name}` : 'Add new staff member'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
              <input
                className="input" required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input
                className="input" type="email" required
                value={form.email}
                disabled={!!editDoc}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {editDoc && (
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <optgroup label="Admin">
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </optgroup>
                <optgroup label="Floor staff">
                  {FLOOR_ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            {!editDoc && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password * <span className="text-gray-400">(min 6 characters)</span>
                </label>
                <input
                  className="input" type="password" required minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            )}

            {/* Station assignment */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned station</label>
              <select className="input" value={form.stationId}
                onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
                <option value="">No station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Services multi-select */}
            {serviceList.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Services this staff can perform
                  <span className="text-gray-400 font-normal ml-1">({form.services.length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {serviceList.map((svc) => {
                    const selected = form.services.includes(svc.name)
                    return (
                      <button key={svc.id} type="button" onClick={() => toggleService(svc.name)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          selected
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                        }`}>
                        {svc.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update staff' : 'Add staff'}
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
                {['Name', 'Email', 'Phone', 'Role', 'Station', 'Services', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                    No staff members found
                  </td>
                </tr>
              )}
              {filtered.map((member) => (
                <tr key={member.id} className={`hover:bg-gray-50 ${member.active === false ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3 text-gray-600">{member.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLORS[member.role] ?? ROLE_COLORS.staff}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{member.stationName || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(member.services || []).length === 0
                        ? <span className="text-xs text-gray-400">—</span>
                        : (member.services || []).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-brand-50 text-brand-700 text-xs rounded">{s}</span>
                          ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {member.active === false ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">Inactive</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isOwnerOrManager && (
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => openEdit(member)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-amber-600 hover:underline"
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.active === false ? 'Activate' : 'Deactivate'}
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === member.id}
                          onClick={() => handleDelete(member)}
                        >
                          {deleting === member.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    )}
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
