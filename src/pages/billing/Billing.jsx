import { useState } from 'react'
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, increment, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import { useSettings, calcPointsEarned, calcMaxRedemption, getEffectivePoints } from '../../hooks/useSettings'
import PageHeader from '../../components/PageHeader'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Wallet']

export default function Billing() {
  const { docs: invoices, loading } = useCollection('invoices')
  const { docs: customers }         = useCollection('customers', 'name')
  const { docs: services }          = useCollection('services', 'name')
  const { loyalty }                 = useSettings()

  const SERVICE_LIST = services.length > 0
    ? services.map((s) => ({ name: s.name, price: s.price ?? 0 }))
    : [
        { name: 'Haircut', price: 300 }, { name: 'Hair colour', price: 1200 },
        { name: 'Blowdry', price: 400 }, { name: 'Facial', price: 800 },
        { name: 'Manicure', price: 500 }, { name: 'Pedicure', price: 600 },
        { name: 'Threading', price: 100 }, { name: 'Waxing', price: 700 },
        { name: 'Massage', price: 1500 },
      ]

  const [showForm, setShowForm]         = useState(false)
  const [editDoc,  setEditDoc]          = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId]     = useState('')
  const [customerPoints, setCustomerPoints] = useState(0)
  const [selectedServices, setSelectedServices] = useState([])
  const [discount, setDiscount]         = useState(0)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [paymentMode, setPaymentMode]   = useState('Cash')
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(null)

  const subtotal      = selectedServices.reduce((s, i) => s + i.price, 0)
  const redeemDiscount = redeemPoints * loyalty.redeemValue
  const total         = Math.max(0, subtotal - Number(discount) - redeemDiscount)
  const pointsEarned  = calcPointsEarned(total, loyalty)
  const maxRedeemable = calcMaxRedemption(subtotal, customerPoints, loyalty)
  const canRedeem     = customerPoints >= loyalty.minPointsRedeem

  function toggleService(svc) {
    setSelectedServices((prev) =>
      prev.find((s) => s.name === svc.name)
        ? prev.filter((s) => s.name !== svc.name)
        : [...prev, svc]
    )
  }

  function selectCustomer(id) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c) {
      setCustomerName(c.name)
      setCustomerPoints(getEffectivePoints(c, loyalty))
    } else {
      setCustomerPoints(0)
    }
    setRedeemPoints(0)
  }

  function openEdit(inv) {
    setEditDoc(inv)
    setCustomerName(inv.customerName)
    setCustomerId(inv.customerId || '')
    const c = customers.find((x) => x.id === inv.customerId)
    setCustomerPoints(c ? getEffectivePoints(c, loyalty) : 0)
    setSelectedServices(inv.services || [])
    setDiscount(inv.discount ?? 0)
    setRedeemPoints(inv.redeemPoints ?? 0)
    setPaymentMode(inv.paymentMode || 'Cash')
    setShowForm(true)
  }

  function resetForm() {
    setEditDoc(null)
    setCustomerName('')
    setCustomerId('')
    setCustomerPoints(0)
    setSelectedServices([])
    setDiscount(0)
    setRedeemPoints(0)
    setPaymentMode('Cash')
    setShowForm(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!selectedServices.length) { toast.error('Select at least one service'); return }
    setSaving(true)
    try {
      // Auto-create customer in background (new invoice only)
      let linkedId = customerId
      if (!editDoc && !linkedId && customerName) {
        try {
          const existing = await getDocs(
            query(collection(db, 'customers'), where('name', '==', customerName.trim()))
          )
          if (existing.empty) {
            const newDoc = await addDoc(collection(db, 'customers'), {
              name: customerName.trim(), phone: '1111111111',
              email: '', allergies: '', loyaltyPoints: 0, totalVisits: 0,
              createdAt: serverTimestamp(),
            })
            linkedId = newDoc.id
          } else {
            linkedId = existing.docs[0].id
          }
        } catch (custErr) {
          console.error('Customer auto-create failed:', custErr)
        }
      }

      const payload = {
        customerName,
        customerId:    linkedId || null,
        services:      selectedServices,
        subtotal,
        discount:      Number(discount),
        redeemPoints,
        redeemDiscount,
        total,
        pointsEarned,
        paymentMode,
        status:        'paid',
      }

      if (editDoc) {
        // Reverse old points delta, apply new one
        await updateDoc(doc(db, 'invoices', editDoc.id), { ...payload, updatedAt: serverTimestamp() })
        if (linkedId) {
          const oldDelta = (editDoc.pointsEarned ?? 0) - (editDoc.redeemPoints ?? 0)
          const newDelta = pointsEarned - redeemPoints
          await updateDoc(doc(db, 'customers', linkedId), {
            loyaltyPoints: increment(newDelta - oldDelta),
          })
        }
        toast.success('Invoice updated')
      } else {
        await addDoc(collection(db, 'invoices'), { ...payload, createdAt: serverTimestamp() })
        if (linkedId) {
          await updateDoc(doc(db, 'customers', linkedId), {
            totalVisits:   increment(1),
            loyaltyPoints: increment(pointsEarned - redeemPoints),
          })
        }
        toast.success(`Invoice created · +${pointsEarned} pts earned${redeemPoints > 0 ? ` · ${redeemPoints} pts redeemed` : ''}`)
      }

      resetForm()
    } catch {
      toast.error('Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(inv) {
    if (!window.confirm(`Delete invoice for ${inv.customerName}?`)) return
    setDeleting(inv.id)
    try {
      await deleteDoc(doc(db, 'invoices', inv.id))
      toast.success('Invoice deleted')
    } catch {
      toast.error('Failed to delete invoice')
    } finally {
      setDeleting(null)
    }
  }

  const todayRevenue = invoices
    .filter((i) => {
      const d = i.createdAt?.toDate?.()
      return d && format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    })
    .reduce((s, i) => s + (i.total ?? 0), 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Billing"
        subtitle={`Today's revenue: ₹${todayRevenue.toLocaleString()}`}
        action={<button className="btn-primary" onClick={() => { setEditDoc(null); setShowForm(true) }}>+ New invoice</button>}
      />

      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">{editDoc ? `Edit invoice — ${editDoc.customerName}` : 'New invoice'}</p>
          <form onSubmit={handleSave} className="space-y-4">

            {/* Customer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer name *</label>
                <input className="input" required value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setCustomerId(''); setCustomerPoints(0) }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Link to existing customer</label>
                <select className="input" value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
                  <option value="">Walk-in / new</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Points balance */}
            {customerId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-800">
                    Loyalty points balance: <span className="text-lg font-bold">{customerPoints}</span> pts
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {canRedeem
                      ? `Max redeemable: ${Math.floor(maxRedeemable / loyalty.redeemValue)} pts = ₹${maxRedeemable}`
                      : `Need ${loyalty.minPointsRedeem} pts to redeem (${customerPoints} available)`}
                  </p>
                </div>
                {canRedeem && subtotal > 0 && (
                  <div className="text-right">
                    <label className="block text-xs font-medium text-amber-800 mb-1">Redeem points</label>
                    <input
                      type="number" min="0"
                      max={Math.floor(maxRedeemable / loyalty.redeemValue)}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value), Math.floor(maxRedeemable / loyalty.redeemValue)))}
                      className="input w-28 text-right"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Services */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Services *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SERVICE_LIST.map((svc) => {
                  const selected = selectedServices.some((s) => s.name === svc.name)
                  return (
                    <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        selected
                          ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}>
                      <span className="block">{svc.name}</span>
                      <span className="text-gray-500">₹{svc.price}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Discount (₹)</label>
                <input className="input" type="number" min="0" value={discount}
                  onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment mode</label>
                <select className="input" value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}>
                  {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="card bg-brand-50 border-brand-200 text-right">
                <p className="text-xs text-gray-500">Subtotal: ₹{subtotal}</p>
                {Number(discount) > 0 && <p className="text-xs text-gray-500">Discount: −₹{discount}</p>}
                {redeemPoints > 0 && <p className="text-xs text-green-600">Points: −₹{redeemDiscount} ({redeemPoints} pts)</p>}
                <p className="text-base font-semibold text-brand-700">Total: ₹{total}</p>
                <p className="text-xs text-amber-600 mt-1">+{pointsEarned} pts will be earned</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update invoice' : 'Create invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoices table */}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Customer', 'Services', 'Subtotal', 'Discount', 'Total', 'Pts Earned', 'Payment', 'Date', 'Actions'].map((h) => (  // eslint-disable-line
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm">No invoices yet</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.customerName}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{inv.services?.map((s) => s.name).join(', ')}</td>
                  <td className="px-4 py-3 text-gray-600">₹{inv.subtotal}</td>
                  <td className="px-4 py-3 text-gray-600">₹{inv.discount ?? 0}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">₹{inv.total}</td>
                  <td className="px-4 py-3 text-amber-600 text-xs font-medium">+{inv.pointsEarned ?? 0} pts</td>
                  <td className="px-4 py-3"><span className="badge-blue">{inv.paymentMode}</span></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {inv.createdAt?.toDate ? format(inv.createdAt.toDate(), 'dd MMM, h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(inv)}>Edit</button>
                      <button
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        disabled={deleting === inv.id}
                        onClick={() => handleDelete(inv)}
                      >
                        {deleting === inv.id ? '…' : 'Delete'}
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
