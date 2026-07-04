import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'rose',     label: 'Rose',     color: '#db2777' },
  { id: 'ocean',    label: 'Ocean',    color: '#2563eb' },
  { id: 'forest',   label: 'Forest',   color: '#16a34a' },
  { id: 'violet',   label: 'Violet',   color: '#7c3aed' },
  { id: 'midnight', label: 'Midnight', color: '#06b6d4', dark: true },
]

const ThemeContext = createContext({ theme: 'rose', setTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('salon-theme') || 'rose')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'rose' ? '' : theme)
    localStorage.setItem('salon-theme', theme)
  }, [theme])

  function setTheme(t) {
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
