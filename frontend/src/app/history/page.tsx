'use client'

import { useState } from 'react'
import Typography from '@mui/material/Typography'
import ExecutionTable from '@/components/history/ExecutionTable'
import LogViewer from '@/components/history/LogViewer'
import type { Execution } from '@/lib/types'

export default function HistoryPage() {
  const [selected, setSelected] = useState<Execution | null>(null)

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        History
      </Typography>
      <ExecutionTable onSelect={setSelected} />
      <LogViewer execution={selected} onClose={() => setSelected(null)} />
    </>
  )
}
