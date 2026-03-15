'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Server-side redirect does not work in static export mode.
// Client-side replace is the correct approach here.
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/overview/')
  }, [router])
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
}
