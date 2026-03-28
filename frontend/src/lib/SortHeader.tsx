import TableCell from '@mui/material/TableCell'
import TableSortLabel from '@mui/material/TableSortLabel'
import type { SortDir } from './useTriStateSort'

/**
 * Reusable sort-header cell for MUI tables with tri-state sorting.
 */
export default function SortHeader<T extends string>({
  col, label, active, dir, onSort, align,
}: {
  col: T
  label: string
  active: T | null
  dir: SortDir
  onSort: (c: T) => void
  align?: 'left' | 'right'
}) {
  return (
    <TableCell align={align} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={active === col}
        direction={active === col ? dir : 'asc'}
        onClick={() => onSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )
}
