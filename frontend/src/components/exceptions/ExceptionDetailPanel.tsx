'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { fmtDt } from '@/lib/formatters'
import type { ScheduledException } from '@/lib/types'

function durationLabel(startsAt: string, endsAt: string): string {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime()
  const hours = Math.floor(ms / 3600000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const rem = hours % 24
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`
  }
  const mins = Math.floor((ms % 3600000) / 60000)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{label}</Typography>
      <Typography variant="body2" sx={mono ? { fontFamily: 'monospace', fontSize: 12, fontVariantNumeric: 'tabular-nums' } : { fontSize: 12 }}>{value}</Typography>
    </Box>
  )
}

export default function ExceptionDetailPanel({ ex }: { ex: ScheduledException }) {
  return (
    <Box sx={{ px: 2, py: 2, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
        <DetailField label="Starts" value={fmtDt(ex.startsAt)} mono />
        <DetailField label="Ends" value={fmtDt(ex.endsAt)} mono />
        <DetailField label="Duration" value={durationLabel(ex.startsAt, ex.endsAt)} />
        <DetailField label="Sleep on End" value={ex.sleepOnEnd ? 'Yes' : 'No'} />
        <DetailField label="Created by" value={ex.createdBy} />
        <DetailField label="Created at" value={fmtDt(ex.createdAt)} mono />
        {ex.namespaceFilter && <DetailField label="Namespace Filter" value={ex.namespaceFilter} mono />}
        {ex.labelSelector && <DetailField label="Label Selector" value={ex.labelSelector} mono />}
      </Box>
      {ex.reason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{ex.reason}</Typography>
      )}
      {ex.workloadTargets && ex.workloadTargets.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.5 }}>Workload Targets</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {ex.workloadTargets.map((t, j) => (
              <Chip key={j} label={`${t.kind}/${t.namespace}/${t.name}`} size="small" sx={{ fontFamily: 'monospace', fontSize: 10, height: 20 }} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
