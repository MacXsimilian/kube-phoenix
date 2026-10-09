'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/shared/PageHeader'
import PolicyExecutionTable from '@/components/history/ExecutionTable'
import LogViewer from '@/components/history/LogViewer'
import type { PolicyExecution } from '@/lib/types'

function HistoryContent() {
  const searchParams = useSearchParams()
  const executionIdParam = searchParams.get('exec')
  const initialExecutionId = executionIdParam ? Number(executionIdParam) : undefined
  const [selectedExecution, setSelectedExecution] = useState<PolicyExecution | null>(null)

  return (
    <>
      <PolicyExecutionTable onSelect={setSelectedExecution} initialExecId={initialExecutionId} />
      <LogViewer execution={selectedExecution} onClose={() => setSelectedExecution(null)} />
    </>
  )
}

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" />
      <Suspense>
        <HistoryContent />
      </Suspense>
    </>
  )
}
