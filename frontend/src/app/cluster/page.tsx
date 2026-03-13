'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import WorkloadsTable from '@/components/cluster/WorkloadsTable'
import NodesTable from '@/components/cluster/NodesTable'

function ClusterTabs() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'nodes' ? 1 : 0)

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Workloads" />
          <Tab label="Nodes" />
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
