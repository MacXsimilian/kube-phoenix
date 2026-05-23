'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import PageHeader from '@/components/shared/PageHeader'
import WorkloadsTable from '@/components/cluster/WorkloadsTable'
import NodesTable from '@/components/cluster/NodesTable'
import { getWorkloads, getNodes } from '@/lib/api'
import { WORKLOADS_REFETCH_MS, NODES_REFETCH_MS } from '@/lib/constants'

function ClusterTabs() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'nodes' ? 1 : 0)

  useEffect(() => {
    setTab(searchParams.get('tab') === 'nodes' ? 1 : 0)
  }, [searchParams])

  const { data: workloads = [], isError: workloadsError } = useQuery({ queryKey: queryKeys.workloads(), queryFn: getWorkloads, refetchInterval: WORKLOADS_REFETCH_MS })
  const { data: nodes = [], isError: nodesError } = useQuery({ queryKey: queryKeys.nodes(), queryFn: getNodes, refetchInterval: NODES_REFETCH_MS })

  const workloadLabel = workloadsError ? 'Workloads (?)' : workloads.length ? `Workloads (${workloads.length})` : 'Workloads'
  const nodeLabel = nodesError ? 'Nodes (?)' : nodes.length ? `Nodes (${nodes.length})` : 'Nodes'

  return (
    <>
      <PageHeader
        title="Cluster State"
        tabs={
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={workloadLabel} />
            <Tab label={nodeLabel} />
          </Tabs>
        }
      />
      {tab === 0 && <WorkloadsTable />}
      {tab === 1 && <NodesTable />}
    </>
  )
}

export default function ClusterPage() {
  return (
    <Suspense fallback={<PageHeader title="Cluster State" />}>
      <ClusterTabs />
    </Suspense>
  );
}
