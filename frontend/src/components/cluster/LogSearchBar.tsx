import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SearchIcon from '@mui/icons-material/Search'

interface LogSearchBarProps {
  search: string
  onSearchChange: (value: string) => void
  matchCount: number
  currentMatchIdx: number
  onJump: (direction: 'next' | 'prev') => void
}

export default function LogSearchBar({ search, onSearchChange, matchCount, currentMatchIdx, onJump }: LogSearchBarProps) {
  return (
    <TextField
      size="small"
      placeholder="Search logs..."
      value={search}
      onChange={(e) => onSearchChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && matchCount > 0) {
          onJump(e.shiftKey ? 'prev' : 'next')
        }
      }}
      sx={{ flex: 1, maxWidth: 280 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <Stack direction="row" spacing={0.25} sx={{
                alignItems: "center"
              }}>
                <Typography variant="caption" sx={{ color: matchCount > 0 ? 'primary.main' : 'error.main', whiteSpace: 'nowrap' }}>
                  {matchCount > 0 ? `${currentMatchIdx + 1}/${matchCount}` : 'No matches'}
                </Typography>
                <IconButton size="small" onClick={() => onJump('prev')} disabled={matchCount === 0} sx={{ p: 0.25 }} aria-label="Previous match">
                  <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" onClick={() => onJump('next')} disabled={matchCount === 0} sx={{ p: 0.25 }} aria-label="Next match">
                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </InputAdornment>
          ) : undefined,
          sx: { fontSize: 12 },
        },
      }}
    />
  );
}
