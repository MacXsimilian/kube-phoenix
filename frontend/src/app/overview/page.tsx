'use client'

import Grid from '@mui/material/Grid'
import PageHeader from '@/components/shared/PageHeader'
import ClusterStatusCard from '@/components/overview/ClusterStatusCard'
import ActivityFeed from '@/components/overview/ActivityFeed'

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ClusterStatusCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </>
  );
}
