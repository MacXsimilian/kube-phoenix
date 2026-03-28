import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { useTheme } from '@mui/material/styles'
import { executionStatusColors, executionStatusFallback } from '@/lib/statusColors'

export default function StatusChip({ status }: { status: string }) {
  const isDark = useTheme().palette.mode === 'dark'
  const colors = executionStatusColors(isDark)
  const statusStyle = colors[status as keyof typeof colors] ?? executionStatusFallback(isDark)

  if (status === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <CircularProgress size={12} />
        <Chip label="Running" size="small" sx={{ height: 20, fontSize: 11, bgcolor: statusStyle.bg, color: statusStyle.color }} />
      </Box>
    )
  }

  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      size="small"
      sx={{ height: 20, fontSize: 10, bgcolor: statusStyle.bg, color: statusStyle.color }}
    />
  )
}
