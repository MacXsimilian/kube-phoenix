import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { computeDiff, formatChangeSummary } from './auditDiff'
import DiffLineRow from './DiffLineRow'

export default function JsonDiffView({ before, after }: { before?: string; after?: string }) {
  const lines = useMemo(() => computeDiff(before, after), [before, after])
  if (!lines) return null
  const changedCount = lines.filter(line => line.type !== 'unchanged').length
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {formatChangeSummary(changedCount)}
      </Typography>
      <Box sx={{ borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider', maxHeight: 320, overflowY: 'auto' }}>
        {lines.map(line => <DiffLineRow key={line.key} line={line} />)}
      </Box>
    </Box>
  )
}
