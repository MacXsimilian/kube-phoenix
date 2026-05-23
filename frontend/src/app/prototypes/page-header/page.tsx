'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import PageHeader from '@/components/shared/PageHeader'

function VariantFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3, position: 'relative' }}>
      <Chip
        label={label}
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: 16,
          bgcolor: 'background.default',
          fontWeight: 600,
          fontSize: '0.7rem',
        }}
      />
      {children}
    </Paper>
  )
}

function LiveBadge() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <FiberManualRecordIcon sx={{ fontSize: 8, color: 'success.main' }} />
      <Typography variant="caption" color="text.secondary">
        Live · updated 3s ago
      </Typography>
    </Box>
  )
}

export default function PageHeaderPrototype() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        PageHeader — mockup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Unified header for every top-level route. Replaces the ad-hoc
        Typography h5 patterns currently duplicated across Overview, Policies,
        Cluster, Observability, etc. Variants below from minimal to full.
      </Typography>

      <VariantFrame label="01 · Minimal">
        <PageHeader title="Overview" />
        <Typography variant="caption" color="text.secondary">
          Drop-in replacement for pages that only render an h5 today.
        </Typography>
      </VariantFrame>

      <VariantFrame label="02 · Title + subtitle">
        <PageHeader
          title="Guardrails"
          subtitle="Block risky actions before they hit the cluster."
        />
      </VariantFrame>

      <VariantFrame label="03 · Title + primary action">
        <PageHeader
          title="Policies"
          subtitle="3 active · 1 scheduled"
          actions={
            <Button variant="contained" startIcon={<AddIcon />}>
              New policy
            </Button>
          }
        />
      </VariantFrame>

      <VariantFrame label="04 · Title + freshness meta">
        <PageHeader
          title="Observability"
          meta={<LiveBadge />}
          actions={
            <IconButton size="small" aria-label="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
          }
        />
      </VariantFrame>

      <VariantFrame label="05 · Detail page with breadcrumbs">
        <PageHeader
          breadcrumbs={[
            { label: 'Policies', href: '/policies' },
            { label: 'Friday backup window' },
          ]}
          title="Friday backup window"
          subtitle="Pauses autoscaler · Fri 22:00 → Sat 02:00 UTC"
          actions={
            <>
              <Button variant="outlined" size="small">Disable</Button>
              <Button variant="contained" size="small">Edit</Button>
            </>
          }
        />
      </VariantFrame>

      <VariantFrame label="06 · With tabs (replaces current Cluster pattern)">
        <PageHeader
          title="Cluster State"
          subtitle="Live view of workloads and nodes."
          meta={<LiveBadge />}
          tabs={
            <Tabs value={0} onChange={() => {}}>
              <Tab label="Workloads (42)" />
              <Tab label="Nodes (8)" />
            </Tabs>
          }
        />
      </VariantFrame>

      <VariantFrame label="07 · Kitchen sink">
        <PageHeader
          breadcrumbs={[
            { label: 'Observability', href: '/observability' },
            { label: 'Scheduler' },
          ]}
          title="Scheduler"
          subtitle="Decision latency, throughput, and queue depth."
          meta={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LiveBadge />
              <Chip size="small" label="Last 3d" variant="outlined" />
            </Box>
          }
          actions={
            <>
              <Button variant="outlined" size="small" startIcon={<RefreshIcon />}>
                Refresh
              </Button>
              <IconButton size="small" aria-label="More">
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            </>
          }
          tabs={
            <Tabs value={1} onChange={() => {}}>
              <Tab label="Overview" />
              <Tab label="Latency" />
              <Tab label="Throughput" />
              <Tab label="Errors" />
            </Tabs>
          }
        />
      </VariantFrame>

      <Divider sx={{ my: 5 }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Before / After — Policies page
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Paper variant="outlined" sx={{ p: 3, flex: 1 }}>
          <Chip label="Today" size="small" sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Policies</Typography>
            <Button variant="contained" startIcon={<AddIcon />} size="small">
              Create
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Bare title with hand-rolled flex row. No context on what the page shows.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, flex: 1 }}>
          <Chip label="With PageHeader" size="small" color="primary" sx={{ mb: 2 }} />
          <PageHeader
            title="Policies"
            subtitle="3 active · 1 scheduled"
            actions={
              <Button variant="contained" size="small" startIcon={<AddIcon />}>
                New policy
              </Button>
            }
          />
          <Typography variant="caption" color="text.secondary">
            Same shape, plus a subtitle slot for at-a-glance counts and a consistent baseline.
          </Typography>
        </Paper>
      </Box>
    </Box>
  )
}
