'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { getWorkloads, getNodes, getSchedules, triggerRun, getExecution } from '@/lib/api'
import type { Execution } from '@/lib/types'
import { timeUntil } from '@/lib/formatters'
import { useRouter } from 'next/navigation'
import LogViewer from '@/components/history/LogViewer'

type TriggerType = 'scale_down' | 'scale_up'

export default function ClusterStatusCard() {
  const qc = useQueryClient()
  const router = useRouter()

  const { data: workloads = [], isLoading: loadingWorkloads, isError: errorWorkloads } = useQuery({ queryKey: ['workloads'], queryFn: getWorkloads, refetchInterval: 30_000 })
  const { data: nodes = [], isLoading: loadingNodes, isError: errorNodes } = useQuery({ queryKey: ['nodes'], queryFn: getNodes, refetchInterval: 30_000 })
  const { data: schedules = [], isLoading: loadingSchedules, isError: errorSchedules } = useQuery({ queryKey: ['schedules'], queryFn: getSchedules, refetchInterval: 30_000 })

  const isLoading = loadingWorkloads || loadingNodes || loadingSchedules
  const isError = errorWorkloads || errorNodes || errorSchedules

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
      setTriggerExecId(executionId)
    },
    onError: (err: unknown) => {
      setDialog(null)
      setTriggerError(err instanceof Error ? err.message : 'Trigger failed')
    },
  })

  const sleeping = workloads.filter((w) => w.status === 'sleeping').length
  const running = workloads.filter((w) => w.status === 'running').length
  const activeNodes = nodes.length

  const isPartial = sleeping > 0 && running > 0
  const isSleeping = sleeping > 0 && running === 0

  const statusColor = isSleeping ? '#F59E0B' : isPartial ? '#F97316' : '#22C55E'
  const statusLabel = isSleeping ? 'Cluster Sleeping' : isPartial ? 'Partially Sleeping' : 'Cluster Awake'
  const StatusIcon = isSleeping ? BedtimeIcon : isPartial ? Brightness4Icon : WbSunnyIcon

  // Namespaces with sleeping workloads (shown when partially sleeping)
  const sleepingByNs = useMemo(() => {
    if (!isPartial) return []
    const map = new Map<string, number>()
    workloads.filter((w) => w.status === 'sleeping').forEach((w) => {
      map.set(w.namespace, (map.get(w.namespace) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [workloads, isPartial])

  // Next upcoming enabled schedule
  const nextRun = useMemo(() =>
    [...schedules]
      .filter((s) => s.enabled && s.nextRun)
      .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())[0]
  , [schedules])

  // Impact counts for button tooltips
  const wouldScale = workloads.filter((w) => w.status === 'running').length
  const wouldWake  = workloads.filter((w) => w.status === 'sleeping').length

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={2}>
            CLUSTER STATUS
          </Typography>

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
                    {sleepingByNs.map(([ns, count]) => (
                      <Chip
                        key={ns}
                        label={`${ns} · ${count}`}
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
                <Tooltip title={`Will scale down ~${wouldScale} running workload${wouldScale !== 1 ? 's' : ''}`} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<BedtimeIcon fontSize="small" />}
                      onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_down' }) }}
                      sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
                    >
                      Run Sleep Now
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={`Will restore ~${wouldWake} sleeping workload${wouldWake !== 1 ? 's' : ''}`} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<WbSunnyIcon fontSize="small" />}
                      onClick={() => { setMode('plan'); setDialog({ open: true, type: 'scale_up' }) }}
                      sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
                    >
                      Run Wake Now
                    </Button>
                  </span>
                </Tooltip>
              </Box>

              {/* Next run badge */}
              {nextRun && (
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
                    Next: {nextRun.name} · {timeUntil(nextRun.nextRun!)}
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
