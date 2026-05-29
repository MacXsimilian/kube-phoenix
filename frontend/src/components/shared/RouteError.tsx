'use client'

import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[kp] route error:', error)
  }, [error])

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: '50vh', justifyContent: 'center' }}>
      <Typography variant="h6" color="error">Something went wrong</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {error.message || 'An unexpected error occurred.'}
      </Typography>
      <Button variant="outlined" onClick={reset}>Try again</Button>
    </Box>
  )
}
