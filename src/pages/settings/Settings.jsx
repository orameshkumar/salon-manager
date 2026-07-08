import { useState, useEffect } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import {
  useSettings, LOYALTY_DEFAULTS,
  useUpiSettings, UPI_DEFAULTS,
  useSalonProfile, SALON_DEFAULTS,
  useGstSettings, GST_DEFAULTS,
  useWorkingHours, WORKING_HOURS_DEFAULTS,
} from '../../hooks/useSettings'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_ROLES, FLOOR_ROLES, ALL_ROLES } from '../staff/Staff'
import { useTheme, THEMES } from '../../context/ThemeContext'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

function MyProfile() {
  const { user, profile } = useAuth()
  const [name,     setName]     = useState(profile?.name ?? user?.displayName ?? '')
  const [roles,    setRoles]    = useState(profile?.roles ?? [])
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    setName(profile?.name ?? user?.displayName ?? '')
    setRoles(profile?.roles ?? [])
  }, [profile, user])

  function toggleRole(r) {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim())   { toast.error('Name is required'); return }
    if (!roles.length)  { toast.error('Select at least one role'); return }
    setSaving(true)
    try {
      await setDoc(doc(db, 'employees', user.uid), {
        name:      name.trim(),
        email:     user.email,
        roles,
        active:    true,
        updatedAt: serverTimestamp(),
        ...(profile ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true })
      toast.success('Profile saved — page will refresh with updated access')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card border-brand-200">
      <p className="text-sm font-semibold text-gray-800 mb-1">My profile</p>
      <p className="text-xs text-gray-500 mb-4">
        Set your name and role. Admin roles (owner, manager) unlock Payroll, Staff, Reports and other admin pages.
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Display name *</label>
            <input className="input" required value={name} placeholder="Enter your full name"
              onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input className="input bg-gray-50" disabled value={user?.email ?? ''} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Roles * <span className="text-gray-400 font-normal">({roles.length} selected)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-xs text-gray-400 mb-1">Admin</p>
            {ADMIN_ROLES.map((r) => (
              <button key={r} type="button" onClick={() => toggleRole(r)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                  roles.includes(r)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                }`}>{r}</button>
            ))}
            <p className="w-full text-xs text-gray-400 mt-2 mb-1">Floor staff</p>
            {FLOOR_ROLES.map((r) => (
              <button key={r} type="button" onClick={() => toggleRole(r)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                  roles.includes(r)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}>{r}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Settings() {
  const { profile } = useAuth()
  const isAdmin = (profile?.roles ?? []).some((r) => ADMIN_ROLES.includes(r))
  const { theme, setTheme } = useTheme()

  const { loyalty, loading } = useSettings()
  const [form, setForm]     = useState(LOYALTY_DEFAULTS)
  const [saving, setSaving] = useState(false)

  const { upi } = useUpiSettings()
  const [upiForm, setUpiForm]     = useState(UPI_DEFAULTS)
  const [upiSaving, setUpiSaving] = useState(false)
  useEffect(() => { setUpiForm(upi) }, [upi])

  const { salon } = useSalonProfile()
  const [salonForm, setSalonForm]     = useState(SALON_DEFAULTS)
  const [salonSaving, setSalonSaving] = useState(false)
  useEffect(() => { setSalonForm({ ...SALON_DEFAULTS, ...salon }) }, [salon])

  const { gst } = useGstSettings()
  const [gstForm, setGstForm]     = useState(GST_DEFAULTS)
  const [gstSaving, setGstSaving] = useState(false)
  useEffect(() => { setGstForm({ ...GST_DEFAULTS, ...gst }) }, [gst])

  const { hours } = useWorkingHours()
  const [hoursForm, setHoursForm]     = useState(WORKING_HOURS_DEFAULTS)
  const [hoursSaving, setHoursSaving] = useState(false)
  useEffect(() => { setHoursForm({ ...WORKING_HOURS_DEFAULTS, ...hours }) }, [hours])

  useEffect(() => { setForm(loyalty) }, [loyalty])

  function f(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'loyalty'), {
        ...form,
        earnFixed:       Number(form.earnFixed),
        earnPercent:     Number(form.earnPercent),
        redeemValue:     Number(form.redeemValue),
        minPointsRedeem: Number(form.minPointsRedeem),
        maxRedeemPct:    Number(form.maxRedeemPct),
        expiryDays:      Number(form.expiryDays),
        updatedAt:       serverTimestamp(),
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSalonSave(e) {
    e.preventDefault()
    if (!salonForm.name.trim()) { toast.error('Salon name is required'); return }
    setSalonSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'salon'), { ...salonForm, updatedAt: serverTimestamp() })
      toast.success('Salon profile saved')
    } catch { toast.error('Failed to save') } finally { setSalonSaving(false) }
  }

  async function handleGstSave(e) {
    e.preventDefault()
    setGstSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'gst'), {
        ...gstForm, rate: Number(gstForm.rate), updatedAt: serverTimestamp(),
      })
      toast.success('GST settings saved')
    } catch { toast.error('Failed to save') } finally { setGstSaving(false) }
  }

  async function handleHoursSave(e) {
    e.preventDefault()
    setHoursSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'workingHours'), { ...hoursForm, updatedAt: serverTimestamp() })
      toast.success('Working hours saved')
    } catch { toast.error('Failed to save') } finally { setHoursSaving(false) }
  }

  function setDay(d, key, val) {
    setHoursForm((p) => ({ ...p, [d]: { ...p[d], [key]: val } }))
  }

  async function handleUpiSave(e) {
    e.preventDefault()
    setUpiSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'upi'), {
        ...upiForm,
        updatedAt: serverTimestamp(),
      })
      toast.success('UPI settings saved')
    } catch {
      toast.error('Failed to save UPI settings')
    } finally {
      setUpiSaving(false)
    }
  }

  const exampleTotal    = 1000
  const exampleEarned   = form.earnType === 'percentage'
    ? Math.floor(exampleTotal * Number(form.earnPercent) / 100)
    : Math.floor(exampleTotal / Number(form.earnFixed))
  const exampleRedeem   = 100
  const exampleDiscount = exampleRedeem * Number(form.redeemValue)
  const exampleMaxPct   = Math.floor(exampleTotal * Number(form.maxRedeemPct) / 100)

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Profile and salon configuration" />

      <MyProfile />

      {/* Appearance */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-800 mb-1">Appearance</p>
        <p className="text-xs text-gray-500 mb-4">Choose a colour theme for the app. Your preference is saved locally.</p>
        <div className="flex flex-wrap gap-4">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                theme === t.id
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              {t.label}
              {t.dark && <span className="text-xs text-gray-400">(dark)</span>}
            </button>
          ))}
        </div>
      </div>

      {!isAdmin && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Save your profile with an <strong>owner</strong> or <strong>manager</strong> role above to unlock admin settings and pages.
        </div>
      )}

      {isAdmin && loading && <div className="text-sm text-gray-500">Loading settings…</div>}

      {isAdmin && !loading && <form onSubmit={handleSave} className="space-y-6">

        {/* Earning */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-800 mb-4">Points Earning</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Earning formula</label>
              <div className="flex gap-3">
                {[
                  { val: 'fixed',      label: 'Fixed (₹ per point)' },
                  { val: 'percentage', label: 'Percentage of bill' },
                ].map(({ val, label }) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="earnType" value={val}
                      checked={form.earnType === val}
                      onChange={() => f('earnType', val)} />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {form.earnType === 'fixed' ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Every ₹ <span className="text-brand-600">{form.earnFixed}</span> spent = 1 point
                </label>
                <input className="input max-w-xs" type="number" min="1" value={form.earnFixed}
                  onChange={(e) => f('earnFixed', e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <span className="text-brand-600">{form.earnPercent}%</span> of bill total = points earned
                </label>
                <input className="input max-w-xs" type="number" min="1" max="100" value={form.earnPercent}
                  onChange={(e) => f('earnPercent', e.target.value)} />
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              Example: Bill of ₹{exampleTotal} earns <strong>{exampleEarned} point{exampleEarned !== 1 ? 's' : ''}</strong>
            </div>
          </div>
        </div>

        {/* Redemption */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-800 mb-4">Points Redemption</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                1 point = ₹ <span className="text-brand-600">{form.redeemValue}</span>
              </label>
              <input className="input max-w-xs" type="number" min="1" value={form.redeemValue}
                onChange={(e) => f('redeemValue', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Minimum points required to redeem
              </label>
              <input className="input max-w-xs" type="number" min="0" value={form.minPointsRedeem}
                onChange={(e) => f('minPointsRedeem', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Maximum redemption per bill (% of subtotal)
              </label>
              <input className="input max-w-xs" type="number" min="1" max="100" value={form.maxRedeemPct}
                onChange={(e) => f('maxRedeemPct', e.target.value)} />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              Example: {exampleRedeem} points = ₹{exampleDiscount} discount · Max per ₹{exampleTotal} bill = ₹{exampleMaxPct}
            </div>
          </div>
        </div>

        {/* Expiry */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-800 mb-4">Points Expiry</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Points expire after (days) — set 0 for never
            </label>
            <input className="input max-w-xs" type="number" min="0" value={form.expiryDays}
              onChange={(e) => f('expiryDays', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              {Number(form.expiryDays) === 0 ? 'Points never expire' : `Points expire after ${form.expiryDays} days`}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>}

      {/* Salon Profile */}
      {isAdmin && (
        <form onSubmit={handleSalonSave} className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-1">Salon Profile</p>
            <p className="text-xs text-gray-500 mb-4">
              Shown on printed receipts and throughout the app.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Salon name *</label>
                <input className="input" required placeholder="e.g. The Style Studio"
                  value={salonForm.name}
                  onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Tagline</label>
                <input className="input" placeholder="e.g. Beauty • Billing • Beyond"
                  value={salonForm.tagline}
                  onChange={(e) => setSalonForm({ ...salonForm, tagline: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input className="input" placeholder="e.g. +91 98765 43210" type="tel"
                  value={salonForm.phone}
                  onChange={(e) => setSalonForm({ ...salonForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
                <input className="input" placeholder="e.g. 27AAAAA0000A1Z5"
                  value={salonForm.gstin}
                  onChange={(e) => setSalonForm({ ...salonForm, gstin: e.target.value.toUpperCase() })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <textarea className="input" rows={2} placeholder="Shop address shown on receipts"
                  value={salonForm.address}
                  onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="btn-primary" disabled={salonSaving}>
                {salonSaving ? 'Saving…' : 'Save salon profile'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* GST Settings */}
      {isAdmin && (
        <form onSubmit={handleGstSave} className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-1">GST / Tax Settings</p>
            <p className="text-xs text-gray-500 mb-4">
              When enabled, GST is calculated on top of the bill and shown on receipts.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-brand-600"
                  checked={gstForm.enabled}
                  onChange={(e) => setGstForm({ ...gstForm, enabled: e.target.checked })} />
                <span className="text-sm text-gray-700 font-medium">Enable GST on invoices</span>
              </label>

              {gstForm.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">GST rate (%)</label>
                    <input className="input" type="number" min="0" max="100" step="0.01"
                      value={gstForm.rate}
                      onChange={(e) => setGstForm({ ...gstForm, rate: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Typically 18% for beauty services</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Display label</label>
                    <div className="flex gap-4">
                      {['GST', 'CGST+SGST'].map((lbl) => (
                        <label key={lbl} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gstLabel" value={lbl}
                            checked={gstForm.label === lbl}
                            onChange={() => setGstForm({ ...gstForm, label: lbl })} />
                          <span className="text-sm text-gray-700">{lbl}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">How it appears on receipts</p>
                  </div>
                  <div className="sm:col-span-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                    Example: ₹1,000 bill + {gstForm.rate}% {gstForm.label} = ₹{(1000 * (1 + Number(gstForm.rate) / 100)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} total
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="btn-primary" disabled={gstSaving}>
                {gstSaving ? 'Saving…' : 'Save GST settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Working Hours */}
      {isAdmin && (
        <form onSubmit={handleHoursSave} className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-1">Working Hours</p>
            <p className="text-xs text-gray-500 mb-4">
              Set your salon's open/close times for each day of the week.
            </p>
            <div className="space-y-2">
              {[
                ['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],
                ['fri','Fri'],['sat','Sat'],['sun','Sun'],
              ].map(([d, label]) => {
                const day = hoursForm[d] ?? { open: false, openTime: '09:00', closeTime: '20:00' }
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <label className="flex items-center gap-2 w-20 cursor-pointer flex-shrink-0">
                      <input type="checkbox" className="w-4 h-4 rounded accent-brand-600"
                        checked={day.open}
                        onChange={(e) => setDay(d, 'open', e.target.checked)} />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </label>
                    {day.open ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="time" className="input w-auto py-1.5 min-h-[36px]"
                          value={day.openTime}
                          onChange={(e) => setDay(d, 'openTime', e.target.value)} />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="time" className="input w-auto py-1.5 min-h-[36px]"
                          value={day.closeTime}
                          onChange={(e) => setDay(d, 'closeTime', e.target.value)} />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Closed</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="btn-primary" disabled={hoursSaving}>
                {hoursSaving ? 'Saving…' : 'Save working hours'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* UPI / Payment settings */}
      {isAdmin && (
        <form onSubmit={handleUpiSave} className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-1">UPI Payment Settings</p>
            <p className="text-xs text-gray-500 mb-4">
              UPI is set as the default payment method. Configure your merchant details below.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">UPI ID (VPA) *</label>
                <input className="input" placeholder="e.g. salon@okaxis"
                  value={upiForm.upiId}
                  onChange={(e) => setUpiForm({ ...upiForm, upiId: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Your UPI address customers will pay to</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Merchant name</label>
                <input className="input" placeholder="e.g. The Style Salon"
                  value={upiForm.merchantName}
                  onChange={(e) => setUpiForm({ ...upiForm, merchantName: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Shown to customers during payment</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">QR code image URL <span className="text-gray-400 font-normal">(optional)</span></label>
                <input className="input" placeholder="https://…/qr.png"
                  value={upiForm.qrUrl}
                  onChange={(e) => setUpiForm({ ...upiForm, qrUrl: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Paste a public URL to your UPI QR code image — shown on the billing screen when customer pays via UPI</p>
              </div>
              {upiForm.qrUrl && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">QR preview</p>
                  <img src={upiForm.qrUrl} alt="UPI QR" className="w-36 h-36 object-contain border border-gray-200 rounded-lg" />
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="btn-primary" disabled={upiSaving}>
                {upiSaving ? 'Saving…' : 'Save UPI settings'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
