import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { DiffEntry } from './auditDiff'
import { diffStyle } from './auditDiff'

export default function DiffLineRow({ line }: { line: DiffEntry }) {
  const isDark = useTheme().palette.mode === 'dark'
  const styles = diffStyle(isDark)
  const style = styles[line.type]
  const isChanged = line.type !== 'unchanged'

  const removedColor = isDark ? '#fca5a5' : '#B91C1C'
  const addedColor = isDark ? '#86efac' : '#15803D'

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
          <Box component="span" sx={{ color: removedColor, textDecoration: 'line-through', mr: 1 }}>{line.before}</Box>
          <Box component="span" sx={{ color: addedColor }}>{line.after}</Box>
        </Box>
      ) : (
        <Box component="span" sx={{ color: isChanged ? style.text : 'text.primary', wordBreak: 'break-all' }}>
          {line.before ?? line.after}
        </Box>
      )}
    </Box>
  )
}
