'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/Add'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import EmptyState from '@/components/shared/EmptyState'

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

export default function EmptyStatePrototype() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        EmptyState — mockup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Dashed-border placeholder card for pages with no data yet. Replaces the
        ad-hoc Box + Typography pattern used today in Policies and Exceptions.
      </Typography>

      <VariantFrame label="01 · Title only (replaces current Exceptions)">
        <EmptyState title="No exceptions found." />
      </VariantFrame>

      <VariantFrame label="02 · Title + description">
        <EmptyState
          title="No policies yet"
          description="Create one to define when workloads sleep and wake."
        />
      </VariantFrame>

      <VariantFrame label="03 · Title + description + action">
        <EmptyState
          title="No policies yet"
          description="Create one to define when workloads sleep and wake."
          action={
            <Button variant="contained" startIcon={<AddIcon />}>
              New policy
            </Button>
          }
        />
      </VariantFrame>

      <VariantFrame label="04 · With icon">
        <EmptyState
          icon={<EventBusyOutlinedIcon fontSize="inherit" />}
          title="No exceptions scheduled"
          description="Schedule a one-off window to pause or wake workloads outside the normal policy."
          action={
            <Button variant="contained" startIcon={<AddIcon />}>
              New exception
            </Button>
          }
        />
      </VariantFrame>

      <VariantFrame label="05 · Search returned nothing">
        <EmptyState
          icon={<SearchOffOutlinedIcon fontSize="inherit" />}
          title="No matches"
          description="Try a different namespace or clear the filter."
        />
      </VariantFrame>

      <VariantFrame label="06 · Inbox-style first run">
        <EmptyState
          icon={<InboxOutlinedIcon fontSize="inherit" />}
          title="Nothing here yet"
          description="When workloads run through the scheduler, their history will show up on this page."
        />
      </VariantFrame>
    </Box>
  )
}
