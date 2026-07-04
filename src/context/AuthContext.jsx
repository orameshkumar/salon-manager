import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous profile listener if user changed
      if (unsubProfile) { unsubProfile(); unsubProfile = null }

      if (firebaseUser) {
        setUser(firebaseUser)
        // Real-time profile listener — stays in sync across tabs and after document updates
        unsubProfile = onSnapshot(
          doc(db, 'employees', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data()
              // Normalise: support both legacy `role` (string) and new `roles` (array)
              const roles = data.roles?.length ? data.roles
                : data.role ? [data.role]
                : []
              setProfile({ ...data, roles })
            } else {
              setProfile(null)
            }
            setLoading(false)
          },
          () => {
            setProfile(null)
            setLoading(false)
          }
        )
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
