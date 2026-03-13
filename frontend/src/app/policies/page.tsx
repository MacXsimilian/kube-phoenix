'use client'

import { Suspense, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { policiesApi } from '@/lib/api'
import type { SleepPolicy } from '@/lib/types'
import PolicyCard from '@/components/policies/PolicyCard'
import PolicyDialog from '@/components/policies/PolicyDialog'
import RunPolicyDialog from '@/components/policies/RunPolicyDialog'

function PoliciesContent() {
  const qc = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['policies'],
    queryFn: policiesApi.list,
  })

  const policies = data?.policies ?? []

  const [editDialogState, setEditDialogState] = useState<{
    open: boolean
    policy?: SleepPolicy
  }>({ open: false })

  const [conflictDismissed, setConflictDismissed] = useState(false)

  // Run dialog from query params (PolicyCard uses router.push with params)
  const runPolicyId = searchParams.get('run') ? Number(searchParams.get('run')) : null
  const runEdge = (searchParams.get('edge') ?? 'sleep') as 'sleep' | 'wake'
  const runPolicy = runPolicyId ? policies.find((p) => p.id === runPolicyId) ?? null : null

  function handleCloseRunDialog() {
    const url = new URL(window.location.href)
    url.searchParams.delete('run')
    url.searchParams.delete('edge')
    router.replace(url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''))
  }

  const conflictCount = policies.filter((p) => p.conflictTags?.includes('CONFLICT')).length

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load policies: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    )
  }

  return (
    <>
      {/* Conflict warning banner */}
      {conflictCount > 0 && !conflictDismissed && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setConflictDismissed(true)}
              aria-label="Dismiss conflict warning"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {conflictCount} {conflictCount === 1 ? 'policy has' : 'policies have'} scheduling conflicts.
        </Alert>
      )}

      {/* Policy list */}
      {policies.length === 0 ? (
        <Box
          sx={{
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 2,
            p: 6,
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" color="text.secondary" mb={1}>
            No policies configured.
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Add your first policy to get started.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onEdit={() => setEditDialogState({ open: true, policy })}
              onDelete={() => qc.invalidateQueries({ queryKey: ['policies'] })}
            />
          ))}
        </Box>
      )}

      {/* Edit dialog */}
      <PolicyDialog
        open={editDialogState.open}
        policy={editDialogState.policy}
        onClose={() => setEditDialogState({ open: false })}
      />

      {/* Run dialog (triggered from PolicyCard via URL params) */}
      <RunPolicyDialog
        open={!!runPolicy}
        policy={runPolicy}
        edge={runEdge}
        onClose={handleCloseRunDialog}
      />
    </>
  )
}

export default function PoliciesPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Policies
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Policy
        </Button>
      </Box>

      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        }
      >
        <PoliciesContent />
      </Suspense>

      {/* Add policy dialog */}
      <PolicyDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </>
  )
}
