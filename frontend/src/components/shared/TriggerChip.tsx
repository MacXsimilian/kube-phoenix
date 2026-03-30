import Chip from '@mui/material/Chip'
import { useIsDark } from '@/lib/useIsDark'

const TRIGGER_LABELS: Record<string, { label: string; color: string; darkColor: string }> = {
  scheduled:       { label: 'Scheduled',       color: '#4338CA', darkColor: '#A5B4FC' },
  manual_sleep:    { label: 'Manual',          color: '#6D28D9', darkColor: '#C4B5FD' },
  manual_wake:     { label: 'Manual',          color: '#6D28D9', darkColor: '#C4B5FD' },
  recovery:        { label: 'Recovery',        color: '#0369A1', darkColor: '#7DD3FC' },
  reconcile:       { label: 'Reconcile',       color: '#0E7490', darkColor: '#67E8F9' },
  enforce_sleep:   { label: 'Enforce Sleep',   color: '#B91C1C', darkColor: '#FCA5A5' },
  exception_start: { label: 'Exception',       color: '#92400E', darkColor: '#FCD34D' },
  exception_end:   { label: 'Exception End',   color: '#92400E', darkColor: '#FCD34D' },
  emergency_scale: { label: 'Emergency',       color: '#B91C1C', darkColor: '#FCA5A5' },
  skip_applied:    { label: 'Skip',            color: '#475569', darkColor: '#94A3B8' },
}

export default function TriggerChip({ trigger }: { trigger: string }) {
  const isDark = useIsDark()
  const t = TRIGGER_LABELS[trigger]
  const label = t?.label ?? trigger
  const color = t ? (isDark ? t.darkColor : t.color) : (isDark ? '#94A3B8' : '#475569')

  return (
    <Chip
      label={label}
      size="small"
      sx={{ height: 20, fontSize: 10, color, bgcolor: `${color}18` }}
    />
  )
}
