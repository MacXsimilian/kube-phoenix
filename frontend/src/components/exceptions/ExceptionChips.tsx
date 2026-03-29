'use client'

import Chip from '@mui/material/Chip'
import { getTypeLabel, executionStatusColors, executionStatusFallback } from '@/lib/statusColors'

export function TypeChip({ isDark, type }: { isDark: boolean; type: string }) {
  const t = getTypeLabel(isDark, type)
  return <Chip label={t.label} size="small" sx={{ fontSize: 10, color: t.color, bgcolor: t.bg }} />
}

export function StatusChipEx({ status, isDark }: { status: string; isDark: boolean }) {
  const colors = executionStatusColors(isDark)
  const fallback = executionStatusFallback(isDark)
  const c = colors[status as keyof typeof colors] ?? fallback
  return <Chip label={status} size="small" sx={{ height: 18, fontSize: 10, bgcolor: c.bg, color: c.color }} />
}
