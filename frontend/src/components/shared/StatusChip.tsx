import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { useIsDark } from '@/lib/useIsDark'
import { executionStatusColors, executionStatusFallback } from '@/lib/statusColors'

export default function StatusChip({ status, hideSpinner }: { status: string; hideSpinner?: boolean }) {
  const isDark = useIsDark()
  const colors = executionStatusColors(isDark)
  const statusStyle = colors[status as keyof typeof colors] ?? executionStatusFallback(isDark)

  if (status === 'running') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {!hideSpinner && <CircularProgress size={12} />}
        <Chip label="Running" size="small" sx={{
          height: 20, fontSize: 11, bgcolor: statusStyle.bg, color: statusStyle.color,
          ...(hideSpinner ? {
            animation: 'statusPulse 1.8s ease-in-out infinite',
            '@keyframes statusPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
          } : {}),
        }} />
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
