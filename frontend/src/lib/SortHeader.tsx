import TableCell from '@mui/material/TableCell'
import TableSortLabel from '@mui/material/TableSortLabel'
import type { SortDir } from './useTriStateSort'
import { TABLE_HEAD_CELL_SX } from './tableStyles'

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
    <TableCell align={align} sx={TABLE_HEAD_CELL_SX}>
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
