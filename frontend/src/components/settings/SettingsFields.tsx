'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { LED_COLORS } from '@/lib/statusColors'
import { useIsDark } from '@/lib/useIsDark'

export function StatPill({ label, color }: { label: string; color?: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 600,
        bgcolor: color ? `${color}18` : 'rgba(255,255,255,0.06)',
        color: color ?? 'text.secondary',
        border: '1px solid',
        borderColor: color ? `${color}30` : 'divider',
      }}
    />
  )
}

export function LedDot({ state }: { state: keyof typeof LED_COLORS }) {
  const led = LED_COLORS[state]
  return (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: led.bg,
        boxShadow: `0 0 6px ${led.glow}`,
        animation: state === 'awake' ? 'pulse-led 2s ease-in-out infinite' : undefined,
        '@keyframes pulse-led': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      }}
    />
  )
}

export function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 12 : 13,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export function PulseStat({ label, value }: { label: string; value: string }) {
  const isDark = useIsDark()
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: 10,
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
