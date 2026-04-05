'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import { getPolicies } from '@/lib/api'
import type { Policy } from '@/lib/types'
import PolicyCard from '@/components/policies/PolicyCard'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules, canTriggerSchedules } from '@/lib/rbac'
import Tooltip from '@mui/material/Tooltip'
import { POLICIES_REFETCH_MS } from '@/lib/constants'
import { useSnackbar } from '@/lib/useSnackbar'

export default function PoliciesPage() {
  const { user } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Policy | undefined>()
  const { notify, SnackbarAlert } = useSnackbar()

  const { data: policies, isLoading, error } = useQuery({
    queryKey: queryKeys.policies(),
    queryFn: getPolicies,
    refetchInterval: POLICIES_REFETCH_MS,
  })

  function handleEdit(p: Policy) {
    setEditing(p)
    setDialogOpen(true)
  }

  function handleCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function handleClose() {
    setDialogOpen(false)
    setEditing(undefined)
  }

  const canEdit = canEditSchedules(user?.permissions)
  const canTrigger = canTriggerSchedules(user?.permissions)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Policies</Typography>
        <Tooltip title={!canEdit ? 'You do not have permission to create policies' : ''}>
          <span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              disabled={!canEdit}
            >
              New Policy
            </Button>
          </span>
        </Tooltip>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error">{error instanceof Error ? error.message : 'Failed to load policies'}</Alert>
      )}

      {policies && policies.length === 0 && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No policies yet. Create one to define when workloads sleep and wake.
          </Typography>
        </Box>
      )}

      {policies && policies.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {policies.map(p => (
            <PolicyCard
              key={p.id}
              policy={p}
              onEdit={() => handleEdit(p)}
              onNotify={notify}
              canEdit={canEdit}
              canTrigger={canTrigger}
            />
          ))}
        </Box>
      )}

      <CreatePolicyDialog
        open={dialogOpen}
        onClose={handleClose}
        existing={editing}
        onNotify={notify}
      />

      {SnackbarAlert}
    </Box>
  )
}
