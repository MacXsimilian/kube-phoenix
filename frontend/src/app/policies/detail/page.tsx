'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  getPolicy,
  getPolicyExecutions,
  getPolicyOverrides,
  getExceptions,
} from '@/lib/api'
import type { ScheduledException } from '@/lib/types'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import LedGlowTimeline from '@/components/policies/LedGlowTimeline'
import OverridesSection from '@/components/policies/OverridesSection'
import ExceptionsSection from '@/components/policies/ExceptionsSection'
import ExecutionHistoryTable from '@/components/policies/ExecutionHistoryTable'
import { windowsToText } from '@/lib/windowUtils'
import { useAuth } from '@/lib/auth'
import { canEditSchedules } from '@/lib/rbac'
import { STATE_COLORS, MODE_COLORS } from '@/lib/statusColors'
import { fmtDt } from '@/lib/formatters'

export default function PolicyDetailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const qc = useQueryClient()
  const policyId = Number(searchParams.get('id'))

  const [editOpen, setEditOpen] = useState(false)
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [editingException, setEditingException] = useState<ScheduledException | undefined>()
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const canEdit = canEditSchedules(user?.permissions)

  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => getPolicy(policyId),
    enabled: !!policyId,
  })

  const { data: executions } = useQuery({
    queryKey: ['policy-executions', policyId],
    queryFn: () => getPolicyExecutions({ policyId, pageSize: 20 }),
    enabled: !!policyId,
  })

  const { data: overrides, refetch: refetchOverrides } = useQuery({
    queryKey: ['policy-overrides', policyId],
    queryFn: () => getPolicyOverrides(policyId),
    enabled: !!policyId,
  })

  const { data: exceptions } = useQuery({
    queryKey: ['exceptions', policyId],
    queryFn: () => getExceptions({ policyId }),
    enabled: !!policyId,
  })

  if (!policyId) {
    return <Alert severity="error">No policy ID provided.</Alert>
  }
  if (loadingPolicy) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (!policy) {
    return <Alert severity="error">Policy not found</Alert>
  }

  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown

  return (
    <Box>
      {/* Back + header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => router.push('/policies')} aria-label="Back to policies">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>{policy.name}</Typography>
        <Chip
          label={policy.currentState}
          size="small"
          sx={{ bgcolor: stateStyle.bg, color: stateStyle.color }}
        />
        <Chip
          label={policy.mode.toUpperCase()}
          size="small"
          sx={{
            bgcolor: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).bg,
            color: (MODE_COLORS[policy.mode] ?? MODE_COLORS.plan).color,
          }}
        />
        {canEdit && (
          <Button startIcon={<EditOutlinedIcon />} size="small" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </Box>

      {policy.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{policy.description}</Typography>
      )}

      {/* Schedule info */}
      <Paper sx={{ p: 2, mb: 2.5 }}>
        {/* Windows or cron display */}
        {policy.sleepWindows && policy.sleepWindows.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BedtimeIcon sx={{ fontSize: 16, color: '#a5b4fc' }} />
              <Typography variant="body1" fontWeight={600}>
                {windowsToText(policy.sleepWindows)}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                ({policy.timezone || 'UTC'})
              </Typography>
            </Box>
            <LedGlowTimeline
              windows={policy.sleepWindows}
              overrides={overrides}
              exceptions={exceptions}
              timezone={policy.timezone}
            />
          </Box>
        ) : null}

        {/* Metadata row */}
        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {policy.currentState === 'awake' && policy.nextTransitionAt && (
            <Box>
              <Typography variant="caption" color="text.disabled">Next sleep</Typography>
              <Typography variant="body2">{fmtDt(policy.nextTransitionAt)}</Typography>
            </Box>
          )}
          {policy.currentState === 'sleeping' && policy.nextTransitionAt && (
            <Box>
              <Typography variant="caption" color="text.disabled">Next wake</Typography>
              <Typography variant="body2">{fmtDt(policy.nextTransitionAt)}</Typography>
            </Box>
          )}
          {!(policy.sleepWindows && policy.sleepWindows.length > 0) && (
            <Box>
              <Typography variant="caption" color="text.disabled">Timezone</Typography>
              <Typography variant="body2">{policy.timezone || 'UTC'}</Typography>
            </Box>
          )}
          {policy.namespaceFilter && (
            <Box>
              <Typography variant="caption" color="text.disabled">Namespaces</Typography>
              <Typography variant="body2">{policy.namespaceFilter}</Typography>
            </Box>
          )}
          {policy.labelSelector && (
            <Box>
              <Typography variant="caption" color="text.disabled">Label Selector</Typography>
              <Typography variant="body2" fontFamily="monospace">{policy.labelSelector}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      <OverridesSection
        policyId={policyId}
        overrides={overrides}
        canEdit={canEdit}
        onRefetch={refetchOverrides}
        onInvalidateExceptions={() => qc.invalidateQueries({ queryKey: ['exceptions', policyId] })}
        onNotify={(msg, severity) => setSnack({ msg, severity })}
      />

      <ExceptionsSection
        exceptions={exceptions}
        canEdit={canEdit}
        onAddException={() => { setEditingException(undefined); setExceptionOpen(true) }}
        onEditException={(ex) => { setEditingException(ex); setExceptionOpen(true) }}
      />

      <Divider sx={{ my: 2 }} />

      <ExecutionHistoryTable
        executions={executions}
        policyId={policyId}
        onRowClick={(ex) => router.push(`/policies/detail/?id=${policyId}&exec=${ex.id}`)}
      />

      <CreatePolicyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={policy}
        onNotify={(msg, severity) => setSnack({ msg, severity })}
      />
      <ExceptionDialog
        open={exceptionOpen}
        onClose={() => { setExceptionOpen(false); setEditingException(undefined) }}
        existing={editingException}
        defaultPolicyId={policyId}
        onNotify={(msg, severity) => setSnack({ msg, severity })}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
