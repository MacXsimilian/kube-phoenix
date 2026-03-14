'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import WorkloadsTable from '@/components/cluster/WorkloadsTable'
import NodesTable from '@/components/cluster/NodesTable'
import { getWorkloads, getNodes } from '@/lib/api'

function ClusterTabs() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'nodes' ? 1 : 0)

  const { data: workloads = [] } = useQuery({ queryKey: ['workloads'], queryFn: getWorkloads, refetchInterval: 30_000 })
  const { data: nodes = [] } = useQuery({ queryKey: ['nodes'], queryFn: getNodes, refetchInterval: 30_000 })

  const workloadLabel = workloads.length ? `Workloads (${workloads.length})` : 'Workloads'
  const nodeLabel = nodes.length ? `Nodes (${nodes.length})` : 'Nodes'

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={workloadLabel} />
          <Tab label={nodeLabel} />
        </Tabs>
      </Box>
      {tab === 0 && <WorkloadsTable />}
      {tab === 1 && <NodesTable />}
    </>
  )
}

export default function ClusterPage() {
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Cluster State
      </Typography>
      <Suspense>
        <ClusterTabs />
      </Suspense>
    </>
  )
}
