'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import {
  getPolicy,
  getPolicyExecutions,
  getExceptions,
} from '@/lib/api'
import type { PolicyExecution, ScheduledException } from '@/lib/types'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import LedGlowTimeline from '@/components/policies/LedGlowTimeline'
import ExceptionsSection from '@/components/policies/ExceptionsSection'
import ExecutionHistoryTable from '@/components/policies/ExecutionHistoryTable'
import PolicyHeroBand from '@/components/policies/PolicyHeroBand'
import PolicyMetadataRow from '@/components/policies/PolicyMetadataRow'
import LogViewer from '@/components/history/LogViewer'
import { windowsToText, computeWeeklyStats, hasSleepWindows } from '@/lib/windowUtils'
import { useAuth } from '@/lib/auth'
import { canEditSchedules, canTriggerSchedules } from '@/lib/rbac'
import { stateColors, subtleBorder } from '@/lib/statusColors'
import { fmtDt, timeUntil } from '@/lib/formatters'
import { usePolicyTriggers } from '@/lib/usePolicyTriggers'
import { useIsDark } from '@/lib/useIsDark'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useSnackbar } from '@/lib/useSnackbar'
import TriggerModeDialog, { type TriggerDirection } from '@/components/common/TriggerModeDialog'
import { BLEED_MARGIN_X, BLEED_PADDING_X } from '@/lib/layoutConstants'

function PolicyDetailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const isDark = useIsDark()
  const STATE_COLORS = stateColors(isDark)
  const SUBTLE_BORDER = subtleBorder(isDark)

  const raw = searchParams.get('id')
  const policyId = raw ? parseInt(raw, 10) : NaN

  const [editOpen, setEditOpen] = useState(false)
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [editingException, setEditingException] = useState<ScheduledException | undefined>()
  const { notify, SnackbarAlert } = useSnackbar()
  const [selectedExec, setSelectedExec] = useState<PolicyExecution | null>(null)

  const canEdit = canEditSchedules(user?.permissions)
  const canTrigger = canTriggerSchedules(user?.permissions)

  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => getPolicy(policyId),
    enabled: !isNaN(policyId),
  })

  const { data: executions } = useQuery({
    queryKey: ['policy-executions', policyId],
    queryFn: () => getPolicyExecutions({ policyId, pageSize: 20 }),
    enabled: !isNaN(policyId),
  })

  const { data: exceptions } = useQuery({
    queryKey: ['exceptions', policyId],
    queryFn: () => getExceptions({ policyId }),
    enabled: !isNaN(policyId),
  })

  const { sleepMut, wakeMut, isBusy } = usePolicyTriggers(policyId, notify)
  const [triggerDialog, setTriggerDialog] = useState<TriggerDirection | null>(null)

  if (isNaN(policyId)) {
    return <Alert severity="error">No policy ID provided.</Alert>
  }
  if (loadingPolicy) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (!policy) {
    return <Alert severity="error">Policy not found</Alert>
  }

  const sleepWindows = policy.sleepWindows ?? []
  const weeklyStats = hasSleepWindows(sleepWindows) ? computeWeeklyStats(sleepWindows) : null

  return (
    <ErrorBoundary>
    <Box>
      <PolicyHeroBand
        policy={policy}
        canEdit={canEdit}
        canTrigger={canTrigger}
        trigger={{
          isBusy,
          sleepPending: sleepMut.isPending,
          wakePending: wakeMut.isPending,
          onSleep: () => setTriggerDialog('sleep'),
          onWake: () => setTriggerDialog('wake'),
        }}
        onBack={() => router.push('/policies')}
        onEdit={() => { setExceptionOpen(false); setEditOpen(true) }}
      />

      {/* Timeline band */}
      {hasSleepWindows(sleepWindows) && (
        <Box
          sx={{
            mx: BLEED_MARGIN_X, px: BLEED_PADDING_X, py: 3,
            borderBottom: '1px solid', borderColor: SUBTLE_BORDER,
          }}
        >
          <Box sx={{ display: 'flex', gap: { xs: 2, md: 5 }, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block', fontSize: 11, letterSpacing: 0.5 }}>
                Weekly Schedule &middot; {policy.timezone || 'UTC'}
              </Typography>
              <LedGlowTimeline
                windows={sleepWindows}
                exceptions={exceptions}
                timezone={policy.timezone}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: 12 }}>
                {windowsToText(sleepWindows)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: 0, pt: 0.5 }}>
              {weeklyStats && (
                <>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, letterSpacing: 0.5 }}>Sleep/Week</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: STATE_COLORS.sleeping.color }}>{weeklyStats.sleepHours}h</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, letterSpacing: 0.5 }}>Awake/Week</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: STATE_COLORS.awake.color }}>{weeklyStats.awakeHours}h</Typography>
                  </Box>
                </>
              )}
              {policy.nextTransitionAt && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, letterSpacing: 0.5 }}>
                    {policy.currentState === 'sleeping' ? 'Next Wake' : 'Next Sleep'}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} sx={{
                    color: policy.currentState === 'sleeping' ? STATE_COLORS.awake.color : STATE_COLORS.sleeping.color,
                  }}>
                    {fmtDt(policy.nextTransitionAt)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">{timeUntil(policy.nextTransitionAt)}</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Metadata row (only if no windows) */}
      {!hasSleepWindows(sleepWindows) && <PolicyMetadataRow policy={policy} />}

      {/* Exceptions band */}
      <Box
        sx={{
          mx: BLEED_MARGIN_X, px: BLEED_PADDING_X, py: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
          borderBottom: '1px solid', borderColor: SUBTLE_BORDER,
        }}
      >
        <ExceptionsSection
          exceptions={exceptions}
          canEdit={canEdit}
          onAddException={() => { setEditOpen(false); setEditingException(undefined); setExceptionOpen(true) }}
          onEditException={(ex) => { setEditOpen(false); setEditingException(ex); setExceptionOpen(true) }}
        />
      </Box>

      {/* Execution History band */}
      <Box sx={{ mx: BLEED_MARGIN_X, px: BLEED_PADDING_X, py: 3 }}>
        <ExecutionHistoryTable
          executions={executions}
          onRowClick={setSelectedExec}
        />
      </Box>

      <LogViewer execution={selectedExec} onClose={() => setSelectedExec(null)} />

      {/* Dialogs */}
      <CreatePolicyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={policy}
        onNotify={notify}
      />
      <ExceptionDialog
        open={exceptionOpen}
        onClose={() => { setExceptionOpen(false); setEditingException(undefined) }}
        existing={editingException}
        defaultPolicyId={policyId}
        onNotify={notify}
      />

      <TriggerModeDialog
        open={triggerDialog !== null}
        direction={triggerDialog ?? 'sleep'}
        policyName={policy.name}
        onConfirm={(mode) => {
          if (triggerDialog === 'sleep') sleepMut.mutate(mode)
          else wakeMut.mutate(mode)
        }}
        onClose={() => setTriggerDialog(null)}
      />

      {SnackbarAlert}
    </Box>
    </ErrorBoundary>
  )
}

export default function PolicyDetailPage() {
  return (
    <Suspense>
      <PolicyDetailContent />
    </Suspense>
  )
}
