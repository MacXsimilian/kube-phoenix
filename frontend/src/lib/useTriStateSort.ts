import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

/**
 * Tri-state sort hook: clicking the active column cycles asc -> desc -> none.
 * Clicking a different column activates it in ascending order.
 */
export function useTriStateSort<T extends string>(): {
  sortCol: T | null
  sortDir: SortDir
  handleSort: (col: T) => void
} {
  const [sortCol, setSortCol] = useState<T | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(col: T) {
    if (sortCol === col) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        setSortCol(null)
        setSortDir('asc')
      }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  return { sortCol, sortDir, handleSort }
}
