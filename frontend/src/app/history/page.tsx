'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Typography from '@mui/material/Typography'
import ExecutionTable from '@/components/history/ExecutionTable'
import LogViewer from '@/components/history/LogViewer'
import type { Execution } from '@/lib/types'

function HistoryContent() {
  const searchParams = useSearchParams()
  const initialExecId = searchParams.get('exec') ? Number(searchParams.get('exec')) : undefined
  const [selected, setSelected] = useState<Execution | null>(null)

  return (
    <>
      <ExecutionTable onSelect={setSelected} initialExecId={initialExecId} />
      <LogViewer execution={selected} onClose={() => setSelected(null)} />
    </>
  )
}

export default function HistoryPage() {
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        History
      </Typography>
      <Suspense>
        <HistoryContent />
      </Suspense>
    </>
  )
}
