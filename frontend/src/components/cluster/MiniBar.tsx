import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { pct, pctColor } from '@/lib/formatters'

export interface MiniBarProps {
  used: number
  total: number
  label: string
}

export default function MiniBar({ used, total, label }: MiniBarProps) {
  const isDark = useTheme().palette.mode === 'dark'
  const percentUsed = pct(used, total)
  const color = pctColor(percentUsed, isDark)
  return (
    <Tooltip title={label} arrow>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, display: 'block', mb: 0.25, fontSize: 11 }}>
          {percentUsed}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(percentUsed, 100)}
          aria-label={label}
          sx={{ height: 5, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
        />
      </Box>
    </Tooltip>
  )
}
