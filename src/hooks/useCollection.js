import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useCollection(collectionPath, orderByField = 'createdAt', direction) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const dir = direction ?? (orderByField === 'name' ? 'asc' : 'desc')

  useEffect(() => {
    const q = query(collection(db, collectionPath), orderBy(orderByField, dir))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [collectionPath, orderByField, dir])

  return { docs, loading, error }
}
