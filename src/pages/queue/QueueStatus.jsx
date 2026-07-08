import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useSalonProfile } from '../../hooks/useSettings'
import { format } from 'date-fns'
import SalonLogo from '../../components/SalonLogo'

const STATUS_CONFIG = {
  waiting: {
    icon: '⏳',
    label: 'You are in the queue',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    pulse: true,
  },
  called: {
    icon: '📣',
    label: "It's your turn!",
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    pulse: true,
  },
  seated: {
    icon: '✂️',
    label: 'You are being served',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    pulse: false,
  },
  left: {
    icon: '👋',
    label: 'Visit complete',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    pulse: false,
  },
}

export default function QueueStatus() {
  const { id } = useParams()
  const [entry, setEntry]       = useState(null)
  const [position, setPosition] = useState(null)
  const [totalWaiting, setTotal] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const { salon }               = useSalonProfile()

  // Watch this specific waiting list entry
  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'waitingList', id), (snap) => {
      if (!snap.exists()) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setEntry({ id: snap.id, ...snap.data() })
      setLoading(false)
    }, () => { setNotFound(true); setLoading(false) })
    return unsub
  }, [id])

  // Watch all active waiting entries to compute position
  useEffect(() => {
    const q = query(
      collection(db, 'waitingList'),
      where('status', 'in', ['waiting', 'called']),
      orderBy('addedAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => d.id)
      const pos = all.indexOf(id)
      setPosition(pos >= 0 ? pos + 1 : null)
      setTotal(all.length)
    }, () => {})
    return unsub
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your queue status…</p>
        </div>
      </div>
    )
  }

  if (notFound || !entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg font-semibold text-gray-800 mb-1">Queue entry not found</p>
          <p className="text-sm text-gray-500">This link may have expired or been removed.</p>
        </div>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.waiting
  const isDone = entry.status === 'seated' || entry.status === 'left'
  const addedTime = entry.addedAt?.toDate ? format(entry.addedAt.toDate(), 'h:mm a') : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <SalonLogo size={28} className="text-brand-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-brand-700">{salon.name}</p>
          <p className="text-xs text-gray-500">{salon.tagline}</p>
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 gap-5 max-w-sm mx-auto w-full">

        {/* Status banner */}
        <div className={`w-full rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6 text-center`}>
          <div className={`text-5xl mb-2 ${cfg.pulse ? 'animate-pulse' : ''}`}>{cfg.icon}</div>
          <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</p>

          {entry.status === 'waiting' && position !== null && (
            <div className="mt-4">
              <p className="text-4xl font-black text-gray-800">#{position}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {totalWaiting > 1 ? `of ${totalWaiting} in queue` : 'next up'}
              </p>
            </div>
          )}

          {entry.status === 'called' && (
            <p className="text-sm text-amber-700 mt-3 font-medium">
              Please proceed to the front desk now
            </p>
          )}

          {entry.status === 'seated' && (
            <p className="text-sm text-green-700 mt-3">Enjoy your service!</p>
          )}
        </div>

        {/* Details card */}
        <div className="w-full bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-500">Name</span>
            <span className="text-sm font-semibold text-gray-800">{entry.customerName}</span>
          </div>
          {entry.service && (
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Service</span>
              <span className="text-sm text-gray-700">{entry.service}</span>
            </div>
          )}
          {entry.stylistPref && (
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Preferred stylist</span>
              <span className="text-sm text-gray-700">{entry.stylistPref}</span>
            </div>
          )}
          {entry.estimatedWait && !isDone && (
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Est. wait</span>
              <span className="text-sm text-gray-700">~{entry.estimatedWait} min</span>
            </div>
          )}
          {addedTime && (
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Joined at</span>
              <span className="text-sm text-gray-500">{addedTime}</span>
            </div>
          )}
        </div>

        {/* Live indicator */}
        {!isDone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Live updates — this page refreshes automatically
          </div>
        )}

        {salon.phone && (
          <p className="text-xs text-gray-400 text-center">
            Questions? Call us at <a href={`tel:${salon.phone}`} className="text-brand-600 underline">{salon.phone}</a>
          </p>
        )}
      </div>
    </div>
  )
}
