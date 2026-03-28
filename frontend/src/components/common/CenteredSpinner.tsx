import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export default function CenteredSpinner({ size = 40 }: { size?: number }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress size={size} />
    </Box>
  )
}
