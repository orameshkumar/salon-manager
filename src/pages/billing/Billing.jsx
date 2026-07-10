import { useState, useEffect, useMemo, useCallback } from 'react'
import QRCode from 'qrcode'
import { Timestamp } from 'firebase/firestore'
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, increment, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import { useSettings, calcPointsEarned, calcMaxRedemption, getEffectivePoints, useUpiSettings, useSalonProfile, useGstSettings } from '../../hooks/useSettings'
import { useCommissionRules, calcTotalCommission } from '../../hooks/useCommissionRules'
import PageHeader from '../../components/PageHeader'
import CustomerSearch from '../../components/CustomerSearch'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { printReceipt } from '../../utils/printReceipt'

const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Wallet']

// ── UPI QR ────────────────────────────────────────────────────────────────────
function UpiQR({ upiId, merchantName, amount }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (!upiId || !amount) return
    const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName || '')}&am=${amount}&cu=INR&tn=${encodeURIComponent('Salon payment')}`
    QRCode.toDataURL(link, { width: 160, margin: 1, color: { dark: '#3b0764', light: '#faf5ff' } })
      .then(setDataUrl).catch(() => {})
  }, [upiId, merchantName, amount])

  if (!upiId) return null
  return (
    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center gap-3">
        {dataUrl
          ? <img src={dataUrl} alt="UPI QR" className="w-20 h-20 rounded-lg border border-purple-200 flex-shrink-0" />
          : <div className="w-20 h-20 bg-purple-100 rounded-lg animate-pulse flex-shrink-0" />}
        <div className="min-w-0">
          {merchantName && <p className="text-xs font-semibold text-purple-800 truncate">{merchantName}</p>}
          <p className="text-xs font-mono text-purple-700 truncate">{upiId}</p>
          <p className="text-sm font-bold text-purple-900 mt-1">₹{amount}</p>
          <p className="text-xs text-purple-500 mt-0.5">Scan with any UPI app — amount pre-filled</p>
        </div>
      </div>
    </div>
  )
}

// ── Payment panel (history + add new) ────────────────────────────────────────
function PaymentPanel({ inv, upi, onClose, onDone }) {
  const [amount, setAmount] = useState('')
  const [mode, setMode]     = useState('UPI')
  const [saving, setSaving] = useState(false)

  const payments    = inv.payments ?? []
  const totalPaid   = payments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const balance     = inv.total - totalPaid
  const isOverpaid  = balance < 0
  const isPaid      = balance <= 0

  // QR shows entered amount if filled, else remaining balance (min 0)
  const qrAmount = amount ? Number(amount) : Math.max(0, balance)

  async function handleAdd(e) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      const newPayment = { amount: amt, mode, paidAt: Timestamp.now() }
      const updatedPayments = [...payments, newPayment]
      const newTotalPaid    = updatedPayments.reduce((s, p) => s + p.amount, 0)
      const newBalance      = inv.total - newTotalPaid
      const newStatus       = newBalance <= 0 ? 'paid' : 'partial'

      await updateDoc(doc(db, 'invoices', inv.id), {
        payments:   updatedPayments,
        amountPaid: newTotalPaid,
        balanceDue: Math.max(0, newBalance),
        status:     newStatus,
        paymentMode: mode,
        updatedAt:  serverTimestamp(),
      })

      const msg = newBalance <= 0
        ? `₹${amt} received — invoice fully paid ✓`
        : `₹${amt} received · ₹${newBalance} still pending`
      toast.success(msg)
      setAmount('')
      if (newBalance <= 0) onDone()
    } catch { toast.error('Failed to record payment') } finally { setSaving(false) }
  }

  return (
    <div className="card mb-6 border-brand-200 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Payments — {inv.customerName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Invoice total: <span className="font-medium text-gray-700">₹{inv.total}</span>
            {' · '}Collected: <span className="font-medium text-green-700">₹{totalPaid}</span>
            {' · '}
            {isPaid
              ? isOverpaid
                ? <span className="font-medium text-amber-600">Overpaid ₹{Math.abs(balance)}</span>
                : <span className="font-medium text-green-600">Fully paid</span>
              : <span className="font-medium text-red-600">Balance ₹{balance}</span>}
          </p>
        </div>
        <button className="text-xs text-gray-400 hover:text-gray-600 mt-0.5" onClick={onClose}>✕ Close</button>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Date</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Mode</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {p.paidAt?.toDate
                      ? format(p.paidAt.toDate(), 'dd MMM, h:mm a')
                      : p.paidAt?.seconds
                      ? format(new Date(p.paidAt.seconds * 1000), 'dd MMM, h:mm a')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{p.mode}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{p.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td colSpan={3} className="px-3 py-2 text-gray-600 text-right">Total collected</td>
                <td className="px-3 py-2 text-right text-green-700">₹{totalPaid.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-4">No payments recorded yet.</p>
      )}

      {/* Add new payment */}
      <form onSubmit={handleAdd}>
        <p className="text-xs font-semibold text-gray-700 mb-2">
          {isPaid ? 'Record additional payment' : 'Add payment'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="payment-amount" className="block text-xs font-medium text-gray-700 mb-1">
              Amount (₹)
              {!isPaid && balance > 0 && (
                <button type="button" className="ml-2 text-brand-600 underline text-xs"
                  onClick={() => setAmount(String(balance))}>
                  Use ₹{balance}
                </button>
              )}
            </label>
            <input id="payment-amount" className="input" type="number" min="1" step="1"
              placeholder={isPaid ? 'Enter amount' : `Remaining: ₹${balance}`}
              value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label htmlFor="payment-mode" className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
            <select id="payment-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </div>

        {mode === 'UPI' && upi.upiId && qrAmount > 0 && (
          <UpiQR upiId={upi.upiId} merchantName={upi.merchantName} amount={qrAmount} />
        )}
      </form>
    </div>
  )
}

// ── Main Billing page ─────────────────────────────────────────────────────────
export default function Billing() {
  const { docs: invoices, loading } = useCollection('invoices')
  const { docs: customers }         = useCollection('customers', 'name')
  const { docs: services }          = useCollection('services', 'name')
  const { docs: employees }         = useCollection('employees', 'name')
  const { loyalty }                 = useSettings()
  const { upi }                     = useUpiSettings()
  const { salon }                   = useSalonProfile()
  const { gst }                     = useGstSettings()
  const { rules: commissionRules }  = useCommissionRules()

  const activeStaff = useMemo(() => employees.filter((e) => e.active !== false), [employees])

  const SERVICE_LIST = useMemo(() => services.map((s) => ({
    name: s.name, price: s.price ?? 0,
    category: s.category ?? '',
    commissionType: s.commissionType ?? 'none',
    commissionValue: s.commissionValue ?? 0,
  })), [services])

  const [invSearch, setInvSearch]       = useState('')
  const [svcSearch, setSvcSearch]       = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [editDoc,  setEditDoc]          = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId]     = useState('')
  const [customerPoints, setCustomerPoints] = useState(0)
  const [selectedServices, setSelectedServices] = useState([])
  const [staffId, setStaffId]           = useState('')
  const [staffName, setStaffName]       = useState('')
  const [discount, setDiscount]         = useState(0)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [initAmount, setInitAmount]     = useState('')   // initial payment at invoice creation
  const [initMode, setInitMode]         = useState('UPI')
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(null)
  const [paymentInvId, setPaymentInvId] = useState(null) // which invoice's payment panel is open

  const filteredSvcList = useMemo(() => {
    if (!svcSearch.trim()) return SERVICE_LIST
    const q = svcSearch.toLowerCase()
    return SERVICE_LIST.filter((s) => s.name.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q))
  }, [SERVICE_LIST, svcSearch])

  const filteredInvoices = useMemo(() => {
    if (!invSearch.trim()) return invoices
    const q = invSearch.toLowerCase()
    return invoices.filter((i) =>
      i.customerName?.toLowerCase().includes(q) ||
      i.staffName?.toLowerCase().includes(q) ||
      i.services?.some((s) => s.name.toLowerCase().includes(q))
    )
  }, [invoices, invSearch])

  const invPag = usePagination(filteredInvoices, 20)

  const subtotal       = selectedServices.reduce((s, i) => s + i.price, 0)
  const redeemDiscount = redeemPoints * loyalty.redeemValue
  const total          = Math.max(0, subtotal - Number(discount) - redeemDiscount)
  const initAmtNum     = initAmount === '' ? 0 : Math.max(0, Number(initAmount))
  const initBalance    = Math.max(0, total - initAmtNum)
  const pointsEarned   = calcPointsEarned(total, loyalty)
  const maxRedeemable  = calcMaxRedemption(subtotal, customerPoints, loyalty)
  const canRedeem      = customerPoints >= loyalty.minPointsRedeem
  const staffCommission = calcTotalCommission(selectedServices, staffId, commissionRules)

  function toggleService(svc) {
    setSelectedServices((prev) =>
      prev.find((s) => s.name === svc.name)
        ? prev.filter((s) => s.name !== svc.name)
        : [...prev, svc]
    )
  }

  const selectCustomerById = useCallback((id) => {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    setCustomerName(c?.name ?? '')
    setCustomerPoints(c ? getEffectivePoints(c, loyalty) : 0)
    setRedeemPoints(0)
  }, [customers, loyalty])

  const selectCustomerByName = useCallback((name, phone) => {
    setCustomerName(name)
    const c = customers.find((x) => x.name === name && (!phone || x.phone === phone))
    if (c) {
      setCustomerId(c.id)
      setCustomerPoints(getEffectivePoints(c, loyalty))
    } else {
      setCustomerId('')
      setCustomerPoints(0)
    }
    setRedeemPoints(0)
  }, [customers, loyalty])

  function openEdit(inv) {
    setEditDoc(inv)
    setCustomerName(inv.customerName)
    setCustomerId(inv.customerId || '')
    const c = customers.find((x) => x.id === inv.customerId)
    setCustomerPoints(c ? getEffectivePoints(c, loyalty) : 0)
    setSelectedServices(inv.services || [])
    setStaffId(inv.staffId || '')
    setStaffName(inv.staffName || '')
    setDiscount(inv.discount ?? 0)
    setRedeemPoints(inv.redeemPoints ?? 0)
    // When editing, don't re-enter payments — they're managed via PaymentPanel
    setInitAmount('')
    setInitMode(inv.paymentMode || 'UPI')
    setShowForm(true)
  }

  function resetForm() {
    setEditDoc(null)
    setCustomerName(''); setCustomerId(''); setCustomerPoints(0)
    setSelectedServices([]); setStaffId(''); setStaffName('')
    setDiscount(0); setRedeemPoints(0)
    setInitAmount(''); setInitMode('UPI')
    setShowForm(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!selectedServices.length) { toast.error('Select at least one service'); return }
    setSaving(true)
    try {
      let linkedId = customerId
      if (!editDoc && !linkedId && customerName) {
        try {
          const snap = await getDocs(query(collection(db, 'customers'), where('name', '==', customerName.trim())))
          if (snap.empty) {
            const ref = await addDoc(collection(db, 'customers'), {
              name: customerName.trim(), phone: '1111111111',
              email: '', allergies: '', loyaltyPoints: 0, totalVisits: 0, createdAt: serverTimestamp(),
            })
            linkedId = ref.id
          } else { linkedId = snap.docs[0].id }
        } catch {}
      }

      // Build payments array for new invoices
      const initialPayments = (!editDoc && initAmtNum > 0)
        ? [{ amount: initAmtNum, mode: initMode, paidAt: Timestamp.now() }]
        : (editDoc?.payments ?? [])

      const totalPaid   = initialPayments.reduce((s, p) => s + p.amount, 0)
      const balanceDue  = Math.max(0, total - totalPaid)
      const status      = totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

      const payload = {
        customerName, customerId: linkedId || null,
        services: selectedServices,
        staffId: staffId || null, staffName: staffName || null,
        staffCommission: staffId ? staffCommission : 0,
        subtotal, discount: Number(discount),
        redeemPoints, redeemDiscount, total,
        payments: initialPayments,
        amountPaid: totalPaid,
        balanceDue, status,
        paymentMode: initialPayments.length > 0 ? initialPayments[initialPayments.length - 1].mode : initMode,
        pointsEarned,
      }

      if (editDoc) {
        await updateDoc(doc(db, 'invoices', editDoc.id), { ...payload, updatedAt: serverTimestamp() })
        if (linkedId) {
          const oldDelta = (editDoc.pointsEarned ?? 0) - (editDoc.redeemPoints ?? 0)
          const newDelta = pointsEarned - redeemPoints
          await updateDoc(doc(db, 'customers', linkedId), { loyaltyPoints: increment(newDelta - oldDelta) })
        }
        toast.success('Invoice updated')
      } else {
        await addDoc(collection(db, 'invoices'), { ...payload, createdAt: serverTimestamp() })
        if (linkedId) {
          await updateDoc(doc(db, 'customers', linkedId), {
            totalVisits: increment(1),
            loyaltyPoints: increment(pointsEarned - redeemPoints),
          })
        }
        toast.success(`Invoice created${initAmtNum > 0 ? ` · ₹${initAmtNum} recorded` : ''}`)
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
    } catch { toast.error('Failed to delete invoice') } finally { setDeleting(null) }
  }

  const todayRevenue = invoices
    .filter((i) => {
      const d = i.createdAt?.toDate?.()
      return d && format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    })
    .reduce((s, i) => s + (i.amountPaid ?? i.total ?? 0), 0)

  const paymentInv = paymentInvId ? invoices.find((i) => i.id === paymentInvId) : null

  const STATUS_STYLE = {
    paid:    'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid:  'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Billing"
        subtitle={`Today's collections: ₹${todayRevenue.toLocaleString()}`}
        action={<button className="btn-primary" onClick={() => { setEditDoc(null); setShowForm(true) }}>+ New invoice</button>}
      />

      {/* New / edit invoice form */}
      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit invoice — ${editDoc.customerName}` : 'New invoice'}
          </p>
          <form onSubmit={handleSave} className="space-y-4">

            {/* Customer */}
            <div>
              <label htmlFor="inv-cust-search" className="block text-xs font-medium text-gray-700 mb-1">
                Customer *
                {customerId && <span className="ml-2 text-green-600 font-normal">✓ Linked — loyalty points active</span>}
              </label>
              <CustomerSearch
                inputId="inv-cust-search"
                customers={customers}
                value={customerName}
                onChange={selectCustomerByName}
                onClear={() => { setCustomerName(''); setCustomerId(''); setCustomerPoints(0); setRedeemPoints(0) }}
                placeholder="Search by name or phone…"
              />
              {!customerId && customerName && (
                <p className="text-xs text-amber-600 mt-1">New customer — will be auto-created on save</p>
              )}
            </div>

            {/* Staff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="inv-staff" className="block text-xs font-medium text-gray-700 mb-1">Served by (staff)</label>
                <select id="inv-staff" className="input" value={staffId}
                  onChange={(e) => {
                    const emp = activeStaff.find((s) => s.id === e.target.value)
                    setStaffId(e.target.value)
                    setStaffName(emp?.name ?? '')
                  }}>
                  <option value="">Select staff member</option>
                  {activeStaff.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
            </div>

            {/* Loyalty balance */}
            {customerId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-medium text-amber-800">
                    Loyalty balance: <span className="text-lg font-bold">{customerPoints}</span> pts
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {canRedeem
                      ? `Max redeemable: ${Math.floor(maxRedeemable / loyalty.redeemValue)} pts = ₹${maxRedeemable}`
                      : `Need ${loyalty.minPointsRedeem} pts to redeem`}
                  </p>
                </div>
                {canRedeem && subtotal > 0 && (
                  <div>
                    <label htmlFor="inv-redeem-pts" className="block text-xs font-medium text-amber-800 mb-1">Redeem points</label>
                    <input id="inv-redeem-pts" type="number" min="0" max={Math.floor(maxRedeemable / loyalty.redeemValue)}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value), Math.floor(maxRedeemable / loyalty.redeemValue)))}
                      className="input w-28 text-right" />
                  </div>
                )}
              </div>
            )}

            {/* Services */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-3">
                <label className="block text-xs font-medium text-gray-700">
                  Services *
                  {selectedServices.length > 0 && (
                    <span className="ml-2 text-brand-600">{selectedServices.length} selected</span>
                  )}
                </label>
                <input
                  className="input py-1 text-xs w-40"
                  placeholder="Search services…"
                  value={svcSearch}
                  onChange={(e) => setSvcSearch(e.target.value)}
                />
              </div>
              {filteredSvcList.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">No services match "{svcSearch}"</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredSvcList.map((svc) => {
                  const selected = selectedServices.some((s) => s.name === svc.name)
                  return (
                    <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        selected ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}>
                      <span className="block">{svc.name}</span>
                      <span className="text-gray-500">₹{svc.price}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Totals + discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="inv-discount" className="block text-xs font-medium text-gray-700 mb-1">Discount (₹)</label>
                <input id="inv-discount" className="input" type="number" min="0" value={discount}
                  onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="card bg-brand-50 border-brand-200 text-right">
                <p className="text-xs text-gray-500">Subtotal: ₹{subtotal}</p>
                {Number(discount) > 0 && <p className="text-xs text-gray-500">Discount: −₹{discount}</p>}
                {redeemPoints > 0 && <p className="text-xs text-green-600">Points: −₹{redeemDiscount} ({redeemPoints} pts)</p>}
                <p className="text-base font-semibold text-brand-700">Total: ₹{total}</p>
                <p className="text-xs text-amber-600 mt-1">+{pointsEarned} pts will be earned</p>
                {staffId && staffCommission > 0 && (
                  <p className="text-xs text-purple-600 mt-1 border-t border-purple-100 pt-1">
                    Staff commission: ₹{staffCommission} ({staffName})
                  </p>
                )}
              </div>
            </div>

            {/* Initial payment — only for new invoice */}
            {!editDoc && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">
                  Initial payment <span className="font-normal text-gray-400">(optional — you can add payments later)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inv-init-amount" className="block text-xs font-medium text-gray-700 mb-1">
                      Amount collected (₹)
                      {total > 0 && (
                        <button type="button" className="ml-2 text-brand-600 underline text-xs"
                          onClick={() => setInitAmount(String(total))}>
                          Full ₹{total}
                        </button>
                      )}
                    </label>
                    <input id="inv-init-amount" className="input" type="number" min="0" placeholder="0 — pay later"
                      value={initAmount} onChange={(e) => setInitAmount(e.target.value)} />
                    {initAmtNum > 0 && initBalance > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Balance due after: ₹{initBalance}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="inv-init-mode" className="block text-xs font-medium text-gray-700 mb-1">Payment mode</label>
                    <select id="inv-init-mode" className="input" value={initMode} onChange={(e) => setInitMode(e.target.value)}>
                      {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    {initMode === 'UPI' && upi.upiId && (initAmtNum > 0 || total > 0) && (
                      <UpiQR upiId={upi.upiId} merchantName={upi.merchantName}
                        amount={initAmtNum > 0 ? initAmtNum : total} />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update invoice' : 'Create invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment panel */}
      {paymentInv && (
        <PaymentPanel
          inv={paymentInv}
          upi={upi}
          onClose={() => setPaymentInvId(null)}
          onDone={() => setPaymentInvId(null)}
        />
      )}

      {/* Invoices table */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          className="input py-1.5 text-sm w-64"
          placeholder="Search invoices by customer, staff, service…"
          value={invSearch}
          onChange={(e) => { setInvSearch(e.target.value); invPag.reset() }}
        />
        {invSearch && (
          <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setInvSearch(''); invPag.reset() }}>
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="card p-0 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100 animate-pulse">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-4 bg-gray-100 rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Customer', 'Services', 'Staff', 'Commission', 'Total', 'Collected', 'Balance', 'Status', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invPag.slice.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm">
                    {invSearch ? `No invoices match "${invSearch}"` : 'No invoices yet'}
                  </td></tr>
                )}
                {invPag.slice.map((inv) => {
                  const paid    = inv.amountPaid ?? 0
                  const balance = Math.max(0, inv.total - paid)
                  const status  = inv.status ?? (balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid')
                  return (
                    <tr key={inv.id} className={`hover:bg-gray-50 ${paymentInvId === inv.id ? 'bg-brand-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.customerName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px] truncate">
                        {inv.services?.map((s) => s.name).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{inv.staffName || '—'}</td>
                      <td className="px-4 py-3 text-purple-600 text-xs font-medium">
                        {inv.staffCommission > 0 ? `₹${inv.staffCommission}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">₹{inv.total}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">
                        ₹{paid.toLocaleString()}
                        {(inv.payments?.length ?? 0) > 1 && (
                          <span className="ml-1 text-xs text-gray-400">({inv.payments.length} pmts)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {balance > 0 ? <span className="text-red-600 font-medium">₹{balance}</span> : <span className="text-green-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {inv.createdAt?.toDate ? format(inv.createdAt.toDate(), 'dd MMM, h:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button className="text-xs text-green-600 hover:underline font-medium"
                            onClick={() => setPaymentInvId(paymentInvId === inv.id ? null : inv.id)}>
                            {paymentInvId === inv.id ? 'Hide' : (status === 'paid' ? 'Payments' : 'Pay')}
                          </button>
                          <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(inv)}>Edit</button>
                          <button className="text-xs text-purple-600 hover:underline"
                            onClick={() => printReceipt(inv, upi.merchantName || salon.name || 'Salon Manager', salon, gst)}>
                            Print
                          </button>
                          <button className="text-xs text-red-600 hover:underline disabled:opacity-50"
                            disabled={deleting === inv.id} onClick={() => handleDelete(inv)}>
                            {deleting === inv.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={invPag.page}
            totalPages={invPag.totalPages}
            onPage={invPag.setPage}
            total={invPag.total}
            pageSize={20}
          />
        </div>
      )}
    </div>
  )
}
