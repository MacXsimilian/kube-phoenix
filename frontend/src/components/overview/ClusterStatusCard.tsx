'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import Skeleton from '@mui/material/Skeleton'
import { getOverview, getSchedules, triggerRun, getExecution } from '@/lib/api'
import type { Execution, Overview } from '@/lib/types'
import { timeUntil } from '@/lib/formatters'
import { useRouter } from 'next/navigation'
import LogViewer from '@/components/history/LogViewer'
import { useAuth } from '@/lib/auth'
import { canTriggerSchedules } from '@/lib/rbac'

type TriggerType = 'scale_down' | 'scale_up'

// useClusterStream subscribes to the backend SSE stream and pushes received
// Overview updates directly into the TanStack Query cache, eliminating polling.
function useClusterStream() {
  const qc = useQueryClient()
  const mountedRef = useRef(true)
  const [disconnected, setDisconnected] = useState(false)
  const failCountRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    async function connect() {
      while (mountedRef.current) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/cluster/stream`,
            { signal: controller.signal, credentials: 'include' },
          )
          if (!res.ok || !res.body) {
            failCountRef.current += 1
            if (failCountRef.current > 1) setDisconnected(true)
            await new Promise((r) => setTimeout(r, 5_000))
            continue
          }
          failCountRef.current = 0
          setDisconnected(false)
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          while (mountedRef.current) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  qc.setQueryData<Overview>(['overview'], JSON.parse(line.slice(6)))
                } catch { /* skip malformed events */ }
              }
            }
          }
        } catch {
          if (!mountedRef.current) break
          failCountRef.current += 1
          if (failCountRef.current > 1) setDisconnected(true)
          await new Promise((r) => setTimeout(r, 3_000))
        }
      }
    }

    connect()
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [qc])

  return disconnected
}

export default function ClusterStatusCard() {
  const qc = useQueryClient()
  const router = useRouter()
  const { user } = useAuth()
  const hasTrigger = canTriggerSchedules(user?.permissions)

  // Single overview query — fed by SSE in real time, polls as fallback
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ['overview'],
    queryFn: getOverview,
    staleTime: 25_000,
    refetchInterval: 30_000,
  })

  // Schedules only needed for trigger button (find schedule ID by type)
  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Subscribe to SSE — updates the overview query cache in real time
  const streamDisconnected = useClusterStream()

  const [dialog, setDialog] = useState<{ open: boolean; type: TriggerType } | null>(null)
  const [mode, setMode] = useState<'plan' | 'apply'>('plan')
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [triggerExecId, setTriggerExecId] = useState<number | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)

  const { data: triggeredExec } = useQuery({
    queryKey: ['execution', triggerExecId],
    queryFn: () => getExecution(triggerExecId!),
    enabled: triggerExecId !== null,
  })

  useEffect(() => {
    if (triggeredExec) {
      setSelectedExecution(triggeredExec)
      setTriggerExecId(null)
    }
  }, [triggeredExec])

  const trigger = useMutation({
    mutationFn: ({ type, m }: { type: TriggerType; m: 'plan' | 'apply' }) => {
      const sc = schedules.find((s) => s.type === type)
      if (!sc) throw new Error(`No ${type} schedule found`)
      return triggerRun(sc.id, m)
    },
    onSuccess: ({ executionId }) => {
      setDialog(null)
      qc.invalidateQueries({ queryKey: ['executions'] })
      qc.invalidateQueries({ queryKey: ['overview'] })
      setTriggerExecId(executionId)
    },
    onError: (err: unknown) => {
      setDialog(null)
      setTriggerError(err instanceof Error ? err.message : 'Trigger failed')
    },
  })

  const sleeping = overview?.sleepingCount ?? 0
  const running = overview?.runningCount ?? 0
  const activeNodes = overview?.nodeCount ?? 0
  const sleepingByNs = overview?.sleepingByNs ?? []
  const isPartial = sleeping > 0 && running > 0
  const isSleeping = sleeping > 0 && running === 0

  const statusColor = isSleeping ? '#F59E0B' : isPartial ? '#F97316' : '#22C55E'
  const statusLabel = isSleeping ? 'Cluster Sleeping' : isPartial ? 'Partially Sleeping' : 'Cluster Awake'
  const StatusIcon = isSleeping ? BedtimeIcon : isPartial ? Brightness4Icon : WbSunnyIcon

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              CLUSTER STATUS
            </Typography>
            {streamDisconnected && (
              <Chip label="Live updates paused" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(245,158,11,0.15)', color: 'warning.main' }} />
            )}
          </Box>

          {isError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Could not load cluster data — showing last known state.
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
              <Skeleton variant="rounded" height={28} width={180} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="rounded" height={24} width={110} />
                <Skeleton variant="rounded" height={24} width={130} />
                <Skeleton variant="rounded" height={24} width={120} />
              </Box>
            </Box>
          ) : null}

          {!isLoading && isError && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={700} color="text.secondary">
                Status Unknown
              </Typography>
            </Box>
          )}

          {!isLoading && !isError && (
            <>
              {/* Status indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: sleepingByNs.length > 0 ? 1.5 : 3 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: statusColor,
                    boxShadow: `0 0 8px ${statusColor}`,
                    flexShrink: 0,
                    ...(isPartial || isSleeping ? {
                      animation: 'statusPulse 2s ease-in-out infinite',
                      '@keyframes statusPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
                    } : {}),
                  }}
                />
                <StatusIcon sx={{ fontSize: 18, color: statusColor }} />
                <Typography variant="h6" fontWeight={700}>
                  {statusLabel}
                </Typography>
              </Box>

              {/* Partial namespace breakdown */}
              {sleepingByNs.length > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: 'rgba(249,115,22,0.07)',
                    border: '1px solid rgba(249,115,22,0.18)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#F97316', fontWeight: 600, display: 'block', mb: 0.75 }}>
                    {sleepingByNs.length} namespace{sleepingByNs.length !== 1 ? 's' : ''} with sleeping workloads
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {sleepingByNs.map(({ namespace, count }) => (
                      <Chip
                        key={namespace}
                        label={`${namespace} · ${count}`}
                        size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(249,115,22,0.12)', color: '#F97316', '& .MuiChip-label': { px: 0.75 } }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Stats row */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                <Chip
                  label={`${activeNodes} Nodes Active`}
                  size="small"
                  onClick={() => router.push('/cluster/?tab=nodes')}
                  sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: 'success.main', fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  label={`${running} Workloads Running`}
                  size="small"
                  onClick={() => router.push('/cluster/?status=running')}
                  sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: 'info.main', fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  label={`${sleeping} Workloads Sleeping`}
                  size="small"
                  onClick={() => router.push('/cluster/?status=sleeping')}
                  sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: 'warning.main', fontWeight: 600, cursor: 'pointer' }}
                />
              </Box>

              {/* Action buttons with impact tooltips */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Tooltip title={hasTrigger ? `Will scale down ~${running} running workload${running !== 1 ? 's' : ''}` : 'You do not have permission to trigger schedules'} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<BedtimeIcon fontSize="small" />}
                      onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_down' }) }}
                      disabled={!hasTrigger}
                      sx={{ borderColor: 'divider', color: 'text.secondary' }}
                    >
                      Run Sleep Now
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={hasTrigger ? `Will restore ~${sleeping} sleeping workload${sleeping !== 1 ? 's' : ''}` : 'You do not have permission to trigger schedules'} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<WbSunnyIcon fontSize="small" />}
                      onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_up' }) }}
                      disabled={!hasTrigger}
                      sx={{ borderColor: 'divider', color: 'text.secondary' }}
                    >
                      Run Wake Now
                    </Button>
                  </span>
                </Tooltip>
              </Box>

              {/* Next run badge */}
              {overview?.nextRun && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mt: 1.75,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(124,58,237,0.1)',
                    border: '1px solid rgba(124,58,237,0.2)',
                  }}
                >
                  <AccessTimeIcon sx={{ fontSize: 13, color: 'primary.light' }} />
                  <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 500 }}>
                    Next: {overview.nextRun.name} · {timeUntil(overview.nextRun.nextRun)}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Trigger dialog */}
      <Dialog
        open={dialog?.open ?? false}
        onClose={() => setDialog(null)}
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 360 } } }}
      >
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {dialog?.type === 'scale_down'
              ? <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              : <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
            {dialog?.type === 'scale_down' ? 'Run Sleep' : 'Run Wake'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose execution mode:
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="plan" sx={{ fontWeight: 600 }}>
              Plan (dry-run)
            </ToggleButton>
            <ToggleButton
              value="apply"
              sx={{ fontWeight: 600, '&.Mui-selected': { bgcolor: 'rgba(245,158,11,0.2)', color: 'warning.main' } }}
            >
              Apply (live)
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={trigger.isPending}
            startIcon={trigger.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => dialog && trigger.mutate({ type: dialog.type, m: mode })}
          >
            Run
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trigger error snackbar */}
      <Snackbar
        open={triggerError !== null}
        autoHideDuration={6000}
        onClose={() => setTriggerError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setTriggerError(null)} sx={{ width: '100%' }}>
          {triggerError}
        </Alert>
      </Snackbar>

      <LogViewer execution={selectedExecution} onClose={() => setSelectedExecution(null)} />
    </>
  )
}
