import { useState, useEffect } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useSettings, LOYALTY_DEFAULTS } from '../../hooks/useSettings'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

export default function Settings() {
  const { loyalty, loading } = useSettings()
  const [form, setForm]     = useState(LOYALTY_DEFAULTS)
  const [saving, setSaving] = useState(false)

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

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>

  const exampleTotal    = 1000
  const exampleEarned   = form.earnType === 'percentage'
    ? Math.floor(exampleTotal * Number(form.earnPercent) / 100)
    : Math.floor(exampleTotal / Number(form.earnFixed))
  const exampleRedeem   = 100
  const exampleDiscount = exampleRedeem * Number(form.redeemValue)
  const exampleMaxPct   = Math.floor(exampleTotal * Number(form.maxRedeemPct) / 100)

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Configure loyalty and points" />

      <form onSubmit={handleSave} className="space-y-6">

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
      </form>
    </div>
  )
}
