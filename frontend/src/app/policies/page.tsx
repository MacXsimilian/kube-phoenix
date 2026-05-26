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
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import PageHeader from '@/components/shared/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import { getPolicies } from '@/lib/api'
import type { Policy } from '@/lib/types'
import PolicyCard from '@/components/policies/PolicyCard'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import ImportDialog from '@/components/import/ImportDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules, canTriggerSchedules } from '@/lib/rbac'
import Tooltip from '@mui/material/Tooltip'
import { POLICIES_REFETCH_MS } from '@/lib/constants'
import { useSnackbar } from '@/lib/useSnackbar'

export default function PoliciesPage() {
  const { user } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Policy | undefined>()
  const [importOpen, setImportOpen] = useState(false)
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
      <PageHeader
        title="Policies"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={!canEdit ? 'You do not have permission to import policies' : ''}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<FileUploadOutlinedIcon />}
                  onClick={() => setImportOpen(true)}
                  disabled={!canEdit}
                >
                  Import
                </Button>
              </span>
            </Tooltip>
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
        }
      />
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error">{error instanceof Error ? error.message : 'Failed to load policies'}</Alert>
      )}
      {policies && policies.length === 0 && (
        <EmptyState
          title="No policies yet"
          description="Create one to define when workloads sleep and wake."
        />
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
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="policy"
        onNotify={notify}
      />
      {SnackbarAlert}
    </Box>
  );
}
