import { useState, useMemo } from 'react'

/**
 * Filter a list of items by a free-text search string.
 *
 * Callers should stabilize `getSearchableText` with `useCallback` so the
 * filtered list is only recomputed when the items or search term change.
 */
export function useTableSearch<T>(
  items: T[],
  getSearchableText: (item: T) => string,
): { search: string; setSearch: (s: string) => void; filtered: T[] } {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () =>
      !search
        ? items
        : items.filter((item) =>
            getSearchableText(item).toLowerCase().includes(search.toLowerCase()),
          ),
    [items, search, getSearchableText],
  )

  return { search, setSearch, filtered }
}
