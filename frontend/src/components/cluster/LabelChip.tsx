import Box from '@mui/material/Box'
import { useIsDark } from '@/lib/useIsDark'

interface LabelChipProps {
  labelKey: string
  value: string
  highlight: boolean
}

export default function LabelChip({ labelKey, value, highlight }: LabelChipProps) {
  const isDark = useIsDark()
  const mutedBg    = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const mutedBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const accentBg    = isDark ? 'rgba(124,58,237,0.06)'  : 'rgba(109,40,217,0.06)'
  const accentBorder = isDark ? 'rgba(124,58,237,0.15)' : 'rgba(109,40,217,0.15)'
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.3,
        px: 1, py: 0.375, borderRadius: 0.5,
        bgcolor: highlight ? accentBg : mutedBg,
        border: '1px solid',
        borderColor: highlight ? accentBorder : mutedBorder,
      }}
    >
      <Box component="span" sx={{ color: 'text.disabled' }}>{labelKey}</Box>
      <Box component="span" sx={{ color: 'text.disabled', mx: '1px' }}>=</Box>
      <Box component="span" sx={{ color: highlight ? 'primary.light' : 'text.primary' }}>{value}</Box>
    </Box>
  )
}
