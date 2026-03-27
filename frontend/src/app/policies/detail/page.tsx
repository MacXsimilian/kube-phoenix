'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import {
  getPolicy,
  getPolicyExecutions,
  getPolicyOverrides,
  getExceptions,
} from '@/lib/api'
import type { PolicyExecution, ScheduledException, SnackMessage } from '@/lib/types'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import LedGlowTimeline from '@/components/policies/LedGlowTimeline'
import OverridesSection from '@/components/policies/OverridesSection'
import ExceptionsSection from '@/components/policies/ExceptionsSection'
import ExecutionHistoryTable from '@/components/policies/ExecutionHistoryTable'
import LogViewer from '@/components/history/LogViewer'
import { windowsToText, computeWeeklyStats, hasSleepWindows } from '@/lib/windowUtils'
import { useAuth } from '@/lib/auth'
import { canEditSchedules, canTriggerSchedules } from '@/lib/rbac'
import {
  STATE_COLORS, MODE_COLORS, SMALL_CHIP_SX,
  HERO_HEADER_GRADIENTS, SUBTLE_BORDER,
} from '@/lib/statusColors'
import { fmtDt, timeUntil } from '@/lib/formatters'
import { usePolicyTriggers } from '@/lib/usePolicyTriggers'
import ErrorBoundary from '@/components/ErrorBoundary'

// ── Layout helpers ───────────────────────────────────────────────────────────

/** Negative margins to bleed bands edge-to-edge within AppShell's padded main area */
const BLEED_MARGIN_X = { xs: -2, sm: -2.5, md: -3 }
const BLEED_PADDING_X = { xs: 2, sm: 2.5, md: 3 }

const STATE_ICONS: Record<string, React.ReactNode> = {
  sleeping:      <BedtimeIcon sx={{ fontSize: 32 }} />,
  awake:         <WbSunnyIcon sx={{ fontSize: 32 }} />,
  transitioning: <WbSunnyIcon sx={{ fontSize: 32 }} />,
  unknown:       <HelpOutlineIcon sx={{ fontSize: 32 }} />,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PolicyDetailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const raw = searchParams.get('id')
  const policyId = raw ? parseInt(raw, 10) : NaN

  const [editOpen, setEditOpen] = useState(false)
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [editingException, setEditingException] = useState<ScheduledException | undefined>()
  const [snack, setSnack] = useState<SnackMessage | null>(null)
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

  const { data: overrides, refetch: refetchOverrides } = useQuery({
    queryKey: ['policy-overrides', policyId],
    queryFn: () => getPolicyOverrides(policyId),
    enabled: !isNaN(policyId),
  })

  const { data: exceptions } = useQuery({
    queryKey: ['exceptions', policyId],
    queryFn: () => getExceptions({ policyId }),
    enabled: !isNaN(policyId),
  })

  function handleNotify(msg: string, severity: SnackMessage['severity']) {
    setSnack({ msg, severity })
  }

  const { sleepMut, wakeMut, isBusy } = usePolicyTriggers(policyId, handleNotify)

  if (isNaN(policyId)) {
    return <Alert severity="error">No policy ID provided.</Alert>
  }
  if (loadingPolicy) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (!policy) {
    return <Alert severity="error">Policy not found</Alert>
  }

  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
  const modeStyle = MODE_COLORS[policy.mode] ?? MODE_COLORS.plan
  const sleepWindows = policy.sleepWindows ?? []
  const weeklyStats = hasSleepWindows(sleepWindows) ? computeWeeklyStats(sleepWindows) : null

  return (
    <ErrorBoundary>
    <Box>
      {/* ── Hero band ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          mx: BLEED_MARGIN_X,
          px: BLEED_PADDING_X,
          py: { xs: 3, md: 4 },
          background: HERO_HEADER_GRADIENTS[policy.currentState] ?? HERO_HEADER_GRADIENTS.unknown,
          borderBottom: '1px solid',
          borderColor: SUBTLE_BORDER,
        }}
      >
        <Box sx={{ mb: 2 }}>
          <IconButton size="small" onClick={() => router.push('/policies')} aria-label="Back to policies">
            <ArrowBackIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              bgcolor: stateStyle.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: stateStyle.color,
              flexShrink: 0,
            }}
          >
            {STATE_ICONS[policy.currentState] ?? STATE_ICONS.unknown}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" fontWeight={700} noWrap>
              {policy.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {policy.description || 'No description'}
              {policy.namespaceFilter && (
                <Typography component="span" fontFamily="monospace" sx={{ ml: 1, color: 'text.disabled' }}>
                  {policy.namespaceFilter}
                </Typography>
              )}
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ color: stateStyle.color, textTransform: 'uppercase', lineHeight: 1.2 }}
            >
              {stateStyle.label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.5 }}>
              <Chip
                label={policy.mode.toUpperCase()}
                size="small"
                sx={{ ...SMALL_CHIP_SX, bgcolor: modeStyle.bg, color: modeStyle.color }}
              />
              {policy.enabled ? (
                <Chip label="Enabled" size="small" sx={{ ...SMALL_CHIP_SX, bgcolor: STATE_COLORS.awake.bg, color: STATE_COLORS.awake.color }} />
              ) : (
                <Chip label="Disabled" size="small" sx={{ ...SMALL_CHIP_SX, bgcolor: 'action.selected' }} />
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
          <Tooltip title={canTrigger ? '' : 'No permission'}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={sleepMut.isPending ? <CircularProgress size={14} /> : <BedtimeIcon />}
                disabled={!canTrigger || isBusy}
                onClick={() => sleepMut.mutate()}
                sx={{ bgcolor: STATE_COLORS.sleeping.bg, color: STATE_COLORS.sleeping.color, '&:hover': { bgcolor: 'rgba(99,102,241,0.3)' } }}
              >
                Sleep Now
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={canTrigger ? '' : 'No permission'}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={wakeMut.isPending ? <CircularProgress size={14} /> : <WbSunnyIcon />}
                disabled={!canTrigger || isBusy}
                onClick={() => wakeMut.mutate()}
                sx={{ bgcolor: STATE_COLORS.awake.bg, color: STATE_COLORS.awake.color, '&:hover': { bgcolor: 'rgba(34,197,94,0.25)' } }}
              >
                Wake Now
              </Button>
            </span>
          </Tooltip>
          {canEdit && (
            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => { setExceptionOpen(false); setEditOpen(true) }}>
              Edit Policy
            </Button>
          )}
          {canEdit && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditOpen(false); setEditingException(undefined); setExceptionOpen(true) }}>
              Exception
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Timeline band ─────────────────────────────────────────────── */}
      {hasSleepWindows(sleepWindows) && (
        <Box
          sx={{
            mx: BLEED_MARGIN_X,
            px: BLEED_PADDING_X,
            py: 3,
            borderBottom: '1px solid',
            borderColor: SUBTLE_BORDER,
          }}
        >
          <Box sx={{ display: 'flex', gap: { xs: 2, md: 5 }, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block', fontSize: 11, letterSpacing: 0.5 }}>
                Weekly Schedule &middot; {policy.timezone || 'UTC'}
              </Typography>
              <LedGlowTimeline
                windows={sleepWindows}
                overrides={overrides}
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

      {/* ── Metadata row (only if no windows) ─────────────────────────── */}
      {!hasSleepWindows(sleepWindows) && (
        <Box
          sx={{
            mx: BLEED_MARGIN_X,
            px: BLEED_PADDING_X,
            py: 2,
            borderBottom: '1px solid',
            borderColor: SUBTLE_BORDER,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.disabled">Timezone</Typography>
            <Typography variant="body2">{policy.timezone || 'UTC'}</Typography>
          </Box>
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
      )}

      {/* ── Overrides + Exceptions band ───────────────────────────────── */}
      <Box
        sx={{
          mx: BLEED_MARGIN_X,
          px: BLEED_PADDING_X,
          py: 3,
          bgcolor: 'rgba(255,255,255,0.015)',
          borderBottom: '1px solid',
          borderColor: SUBTLE_BORDER,
        }}
      >
        <Box sx={{ display: 'flex', gap: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <OverridesSection
              policyId={policyId}
              overrides={overrides}
              canEdit={canEdit}
              onRefetch={refetchOverrides}
              onInvalidateExceptions={() => queryClient.invalidateQueries({ queryKey: ['exceptions', policyId] })}
              onNotify={handleNotify}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ExceptionsSection
              exceptions={exceptions}
              canEdit={canEdit}
              onAddException={() => { setEditOpen(false); setEditingException(undefined); setExceptionOpen(true) }}
              onEditException={(ex) => { setEditOpen(false); setEditingException(ex); setExceptionOpen(true) }}
            />
          </Box>
        </Box>
      </Box>

      {/* ── Execution History band ────────────────────────────────────── */}
      <Box sx={{ mx: BLEED_MARGIN_X, px: BLEED_PADDING_X, py: 3 }}>
        <ExecutionHistoryTable
          executions={executions}
          policyId={policyId}
          onRowClick={setSelectedExec}
        />
      </Box>

      <LogViewer execution={selectedExec} onClose={() => setSelectedExec(null)} />

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
      <CreatePolicyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        existing={policy}
        onNotify={handleNotify}
      />
      <ExceptionDialog
        open={exceptionOpen}
        onClose={() => { setExceptionOpen(false); setEditingException(undefined) }}
        existing={editingException}
        defaultPolicyId={policyId}
        onNotify={handleNotify}
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
    </ErrorBoundary>
  )
}
