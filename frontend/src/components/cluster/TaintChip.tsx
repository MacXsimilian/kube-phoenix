import Box from '@mui/material/Box'
import type { NodeTaint } from '@/lib/types'

const TAINT_EFFECT_FALLBACK = { color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)', borderColor: 'rgba(158,158,158,0.2)' }

interface TaintChipProps {
  taint: NodeTaint
  effectColors: Record<string, { color: string; bg: string; borderColor: string }>
}

export default function TaintChip({ taint, effectColors }: TaintChipProps) {
  const style = effectColors[taint.effect] ?? TAINT_EFFECT_FALLBACK
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        fontFamily: 'monospace', fontSize: 11, lineHeight: 1.3,
        px: 1.25, py: 0.5, borderRadius: 0.5,
        bgcolor: style.bg, border: '1px solid', borderColor: style.borderColor,
        color: style.color,
      }}
    >
      <span>{taint.key}{taint.value ? `=${taint.value}` : ''}</span>
      <Box
        component="span"
        sx={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
          px: 0.625, py: '1px', borderRadius: '3px', bgcolor: 'rgba(0,0,0,0.2)',
        }}
      >
        {taint.effect}
      </Box>
    </Box>
  )
}
