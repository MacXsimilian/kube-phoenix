import Box from '@mui/material/Box'
import type { DiffEntry } from './auditDiff'
import { DIFF_STYLE } from './auditDiff'

export default function DiffLineRow({ line }: { line: DiffEntry }) {
  const style = DIFF_STYLE[line.type]
  const isChanged = line.type !== 'unchanged'
  return (
    <Box sx={{
      display: 'flex', gap: 1, px: 1.5, py: '2px',
      bgcolor: style.bg,
      borderLeft: `2px solid ${style.border}`,
      opacity: isChanged ? 1 : 0.35,
      fontFamily: 'monospace', fontSize: 12,
    }}>
      <Box component="span" sx={{ color: style.border || 'text.disabled', width: 10, flexShrink: 0, userSelect: 'none' }}>
        {style.prefix}
      </Box>
      <Box component="span" sx={{ color: 'text.secondary', flexShrink: 0, mr: 0.5 }}>
        {line.key}:
      </Box>
      {line.type === 'changed' ? (
        <Box component="span" sx={{ wordBreak: 'break-all' }}>
          <Box component="span" sx={{ color: '#fca5a5', textDecoration: 'line-through', mr: 1 }}>{line.before}</Box>
          <Box component="span" sx={{ color: '#86efac' }}>{line.after}</Box>
        </Box>
      ) : (
        <Box component="span" sx={{ color: isChanged ? style.text : 'text.primary', wordBreak: 'break-all' }}>
          {line.before ?? line.after}
        </Box>
      )}
    </Box>
  )
}
