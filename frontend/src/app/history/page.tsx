'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Typography from '@mui/material/Typography'
import PolicyExecutionTable from '@/components/history/ExecutionTable'
import LogViewer from '@/components/history/LogViewer'
import type { PolicyExecution } from '@/lib/types'

function HistoryContent() {
  const searchParams = useSearchParams()
  const initialExecId = searchParams.get('exec') ? Number(searchParams.get('exec')) : undefined
  const [selected, setSelected] = useState<PolicyExecution | null>(null)

  return (
    <>
      <PolicyExecutionTable onSelect={setSelected} initialExecId={initialExecId} />
      <LogViewer execution={selected} onClose={() => setSelected(null)} />
    </>
  )
}

export default function HistoryPage() {
  return (
    <>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 3
        }}>
        History
      </Typography>
      <Suspense>
        <HistoryContent />
      </Suspense>
    </>
  );
}
