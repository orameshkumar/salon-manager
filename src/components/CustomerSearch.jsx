import { useState, useRef, useEffect } from 'react'

/**
 * Typeahead combobox for picking a customer from a large list.
 * Props:
 *   customers  — array of { id, name, phone }
 *   value      — currently selected customer name (string)
 *   onChange   — (name, phone) => void   called when a customer is picked
 *   onClear    — () => void              called when the field is cleared
 *   inputId    — id attribute for the <input> (for htmlFor)
 *   placeholder
 */
export default function CustomerSearch({
  customers = [],
  value = '',
  onChange,
  onClear,
  inputId = 'customer-search',
  placeholder = 'Type to search…',
}) {
  const [query, setQuery]   = useState(value)
  const [open, setOpen]     = useState(false)
  const [active, setActive] = useState(-1)
  const listRef             = useRef(null)
  const inputRef            = useRef(null)

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value) }, [value])

  const filtered = query.trim().length === 0
    ? customers.slice(0, 30)
    : customers.filter((c) =>
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.phone?.includes(query)
      ).slice(0, 30)

  function pick(c) {
    setQuery(c.name)
    setOpen(false)
    setActive(-1)
    onChange(c.name, c.phone || '')
  }

  function handleKey(e) {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(filtered[active]) }
    if (e.key === 'Escape')     { setOpen(false) }
  }

  // Scroll active item into view
  useEffect(() => {
    if (active >= 0 && listRef.current) {
      const el = listRef.current.children[active]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [active])

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          className="input pr-8"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
        />
        {query && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { setQuery(''); onClear?.(); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm"
        >
          {filtered.map((c, i) => (
            <li
              key={c.id}
              onMouseDown={() => pick(c)}
              className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ${
                i === active ? 'bg-brand-50 text-brand-800' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-medium truncate">{c.name}</span>
              {c.phone && <span className="text-xs text-gray-400 flex-shrink-0">{c.phone}</span>}
            </li>
          ))}
        </ul>
      )}

      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          No customers match "{query}"
        </div>
      )}
    </div>
  )
}
