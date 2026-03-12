'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Server-side redirect does not work in static export mode.
// Client-side replace is the correct approach here.
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/overview/')
  }, [router])
  return null
}
