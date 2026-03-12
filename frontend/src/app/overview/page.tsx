'use client'

import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import ClusterStatusCard from '@/components/overview/ClusterStatusCard'
import NextRunCard from '@/components/overview/NextRunCard'
import ActivityFeed from '@/components/overview/ActivityFeed'

export default function OverviewPage() {
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ClusterStatusCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <NextRunCard />
        </Grid>
        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </>
  )
}
