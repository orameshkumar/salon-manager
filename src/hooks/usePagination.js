import { useState, useMemo } from 'react'

export function usePagination(items, pageSize = 15) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage   = Math.min(page, totalPages)

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )

  function reset() { setPage(1) }

  return { page: safePage, setPage, totalPages, slice, total: items.length, reset }
}
