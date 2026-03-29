/**
 * Shared table styling constants for consistent appearance across all pages.
 *
 * Usage:
 *   <TableCell sx={TABLE_HEAD_CELL_SX}>Header</TableCell>
 *   <TableCell sx={TABLE_BODY_CELL_SX}>Content</TableCell>
 */

export const TABLE_HEAD_CELL_SX = {
  fontWeight: 700,
  color: 'text.secondary',
  fontSize: 12,
  whiteSpace: 'nowrap',
} as const

export const TABLE_BODY_CELL_SX = {
  fontSize: 13,
} as const

export const TABLE_BODY_CELL_SECONDARY_SX = {
  fontSize: 13,
  color: 'text.secondary',
} as const

export const TABLE_BODY_CELL_MONO_SX = {
  fontSize: 13,
  fontFamily: 'monospace',
} as const
