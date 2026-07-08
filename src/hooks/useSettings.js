import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

export const LOYALTY_DEFAULTS = {
  earnType:        'fixed',   // 'fixed' | 'percentage'
  earnFixed:       100,       // ₹X spent = 1 point
  earnPercent:     2,         // X% of total = points earned
  redeemValue:     1,         // 1 point = ₹X
  minPointsRedeem: 50,        // minimum points needed to redeem
  maxRedeemPct:    20,        // max % of bill that can be paid by points
  expiryDays:      0,         // 0 = never expire
}

export const UPI_DEFAULTS = {
  upiId:        '',
  merchantName: '',
  qrUrl:        '',
}

export const SALON_DEFAULTS = {
  name:     'Salon Manager',
  tagline:  'Beauty • Billing • Beyond',
  phone:    '',
  address:  '',
  gstin:    '',
}

export const GST_DEFAULTS = {
  enabled:    false,
  rate:       18,     // percentage
  label:      'GST',  // 'GST' | 'CGST+SGST'
}

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
export const WORKING_HOURS_DEFAULTS = Object.fromEntries(
  DAYS.map((d) => [d, { open: d !== 'sun', openTime: '09:00', closeTime: '20:00' }])
)

export function useSalonProfile() {
  const [salon, setSalon]     = useState(SALON_DEFAULTS)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'salon'), (snap) => {
      if (snap.exists()) setSalon({ ...SALON_DEFAULTS, ...snap.data() })
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])
  return { salon, loading }
}

export function useGstSettings() {
  const [gst, setGst]         = useState(GST_DEFAULTS)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'gst'), (snap) => {
      if (snap.exists()) setGst({ ...GST_DEFAULTS, ...snap.data() })
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])
  return { gst, loading }
}

export function useWorkingHours() {
  const [hours, setHours]     = useState(WORKING_HOURS_DEFAULTS)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'workingHours'), (snap) => {
      if (snap.exists()) setHours({ ...WORKING_HOURS_DEFAULTS, ...snap.data() })
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])
  return { hours, loading }
}

export function useUpiSettings() {
  const [upi, setUpi]       = useState(UPI_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'upi'), (snap) => {
      if (snap.exists()) setUpi({ ...UPI_DEFAULTS, ...snap.data() })
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { upi, loading }
}

export function useSettings() {
  const [loyalty, setLoyalty] = useState(LOYALTY_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'loyalty'), (snap) => {
      if (snap.exists()) {
        setLoyalty({ ...LOYALTY_DEFAULTS, ...snap.data() })
      }
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { loyalty, loading }
}

export function calcPointsEarned(total, loyalty) {
  if (loyalty.earnType === 'percentage') {
    return Math.floor(total * loyalty.earnPercent / 100)
  }
  return Math.floor(total / loyalty.earnFixed)
}

export function calcMaxRedemption(subtotal, points, loyalty) {
  const pointsValue  = points * loyalty.redeemValue
  const maxByPercent = Math.floor(subtotal * loyalty.maxRedeemPct / 100)
  return Math.min(pointsValue, maxByPercent)
}

/**
 * Returns true if the customer's loyalty points have expired.
 * loyaltyPointsUpdatedAt: Firestore Timestamp or JS Date of last points change.
 * If expiryDays is 0 (never expire), always returns false.
 */
export function arePointsExpired(loyaltyPointsUpdatedAt, loyalty) {
  if (!loyalty.expiryDays || loyalty.expiryDays <= 0) return false
  if (!loyaltyPointsUpdatedAt) return false
  const updated = loyaltyPointsUpdatedAt?.toDate?.() ?? new Date(loyaltyPointsUpdatedAt)
  const expiresAt = new Date(updated.getTime() + loyalty.expiryDays * 24 * 60 * 60 * 1000)
  return new Date() > expiresAt
}

/**
 * Returns the effective loyalty points for a customer, zeroing out if expired.
 */
export function getEffectivePoints(customer, loyalty) {
  if (arePointsExpired(customer.loyaltyPointsUpdatedAt, loyalty)) return 0
  return customer.loyaltyPoints ?? 0
}
