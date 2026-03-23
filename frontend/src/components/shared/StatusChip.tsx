import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { EXECUTION_STATUS_COLORS, EXECUTION_STATUS_FALLBACK } from '@/lib/statusColors'

export default function StatusChip({ status }: { status: string }) {
  const statusStyle = EXECUTION_STATUS_COLORS[status] ?? EXECUTION_STATUS_FALLBACK

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
      label={status}
      size="small"
      sx={{ height: 18, fontSize: 10, bgcolor: statusStyle.bg, color: statusStyle.color }}
    />
  )
}
