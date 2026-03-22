'use client'

import { useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  getPolicy,
  getPolicyExecutions,
  getPolicyOverrides,
  getExceptions,
  deletePolicyOverride,
  createPolicyOverride,
} from '@/lib/api'
import type { Policy, PolicyOverride, ScheduledException } from '@/lib/types'
import CreatePolicyDialog from '@/components/policies/CreatePolicyDialog'
import ExceptionDialog from '@/components/policies/ExceptionDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules } from '@/lib/rbac'

const STATE_COLORS: Record<string, { bg: string; color: string }> = {
  sleeping:      { bg: 'rgba(99,102,241,0.18)',  color: '#a5b4fc' },
  awake:         { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
  transitioning: { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d' },
  unknown:       { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
}

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    success:     { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
    failed:      { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
    running:     { bg: 'rgba(245,158,11,0.18)',  color: '#fcd34d' },
    interrupted: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    pending:     { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    active:      { bg: 'rgba(34,197,94,0.18)',   color: '#86efac' },
    completed:   { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    cancelled:   { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
  }
  const s = map[status] ?? { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
  return (
    <Chip
      label={status}
      size="small"
      sx={{ height: 18, fontSize: 10, bgcolor: s.bg, color: s.color }}
    />
  )
}

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const qc = useQueryClient()
  const policyId = Number(id)

  const [editOpen, setEditOpen] = useState(false)
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [editingException, setEditingException] = useState<ScheduledException | undefined>()
  const [addOverrideOpen, setAddOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ type: 'stay_awake', reason: '', startsAt: '', endsAt: '', targetCronTime: '' })
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const canEdit = canEditSchedules(user?.permissions)

  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => getPolicy(policyId),
  })

  const { data: executions } = useQuery({
    queryKey: ['policy-executions', policyId],
    queryFn: () => getPolicyExecutions({ policyId, pageSize: 20 }),
  })

  const { data: overrides, refetch: refetchOverrides } = useQuery({
    queryKey: ['policy-overrides', policyId],
    queryFn: () => getPolicyOverrides(policyId),
  })

  const { data: exceptions } = useQuery({
    queryKey: ['exceptions', policyId],
    queryFn: () => getExceptions({ policyId }),
  })

  const deleteOverrideMut = useMutation({
    mutationFn: (overrideId: number) => deletePolicyOverride(policyId, overrideId),
    onSuccess: () => { refetchOverrides(); setSnack({ msg: 'Override deleted', severity: 'success' }) },
    onError: (err: unknown) => setSnack({ msg: err instanceof Error ? err.message : 'Delete failed', severity: 'error' }),
  })

  const createOverrideMut = useMutation({
    mutationFn: () => {
      const isWindowed = overrideForm.type === 'stay_awake' || overrideForm.type === 'force_sleep'
      return createPolicyOverride(policyId, {
        overrideType: overrideForm.type as PolicyOverride['overrideType'],
        reason: overrideForm.reason,
        startsAt: isWindowed ? new Date(overrideForm.startsAt).toISOString() : null,
        endsAt: isWindowed ? new Date(overrideForm.endsAt).toISOString() : null,
        targetCronTime: !isWindowed ? new Date(overrideForm.targetCronTime).toISOString() : null,
      })
    },
    onSuccess: () => {
      refetchOverrides()
      setAddOverrideOpen(false)
      setSnack({ msg: 'Override created', severity: 'success' })
    },
    onError: (err: unknown) => setSnack({ msg: err instanceof Error ? err.message : 'Create failed', severity: 'error' }),
  })

  if (loadingPolicy) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }
  if (!policy) {
    return <Alert severity="error">Policy not found</Alert>
  }

  const stateStyle = STATE_COLORS[policy.currentState] ?? STATE_COLORS.unknown
  const isWindowed = overrideForm.type === 'stay_awake' || overrideForm.type === 'force_sleep'

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
            bgcolor: policy.mode === 'apply' ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)',
            color: policy.mode === 'apply' ? 'warning.main' : 'info.main',
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
        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {policy.sleepCron && (
            <Box>
              <Typography variant="caption" color="text.disabled">Sleep</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BedtimeIcon sx={{ fontSize: 14, color: '#a5b4fc' }} />
                <Typography variant="body2" fontFamily="monospace">{policy.sleepCron}</Typography>
                {policy.nextSleepAt && (
                  <Typography variant="caption" color="text.disabled">next: {fmtDt(policy.nextSleepAt)}</Typography>
                )}
              </Box>
            </Box>
          )}
          {policy.wakeCron && (
            <Box>
              <Typography variant="caption" color="text.disabled">Wake</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WbSunnyIcon sx={{ fontSize: 14, color: '#fcd34d' }} />
                <Typography variant="body2" fontFamily="monospace">{policy.wakeCron}</Typography>
                {policy.nextWakeAt && (
                  <Typography variant="caption" color="text.disabled">next: {fmtDt(policy.nextWakeAt)}</Typography>
                )}
              </Box>
            </Box>
          )}
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
      </Paper>

      {/* Overrides */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Overrides</Typography>
          {canEdit && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOverrideOpen(true)}>
              Add Override
            </Button>
          )}
        </Box>
        {overrides && overrides.length === 0 && (
          <Typography variant="body2" color="text.secondary">No active overrides.</Typography>
        )}
        {overrides && overrides.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Window / Target</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>By</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {overrides.map(ov => (
                <TableRow key={ov.id}>
                  <TableCell><Chip label={ov.overrideType} size="small" sx={{ fontSize: 10 }} /></TableCell>
                  <TableCell>
                    {ov.startsAt ? `${fmtDt(ov.startsAt)} → ${fmtDt(ov.endsAt)}` : fmtDt(ov.targetCronTime)}
                  </TableCell>
                  <TableCell>{ov.reason || '—'}</TableCell>
                  <TableCell>{ov.createdBy}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deleteOverrideMut.mutate(ov.id)}
                        aria-label="Delete override"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      {/* Add override dialog */}
      {addOverrideOpen && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>New Override</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <select
              value={overrideForm.type}
              onChange={e => setOverrideForm(f => ({ ...f, type: e.target.value }))}
              style={{ padding: '6px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
            >
              <option value="stay_awake">Stay Awake (windowed)</option>
              <option value="force_sleep">Force Sleep (windowed)</option>
              <option value="skip_sleep">Skip Next Sleep</option>
              <option value="skip_wake">Skip Next Wake</option>
            </select>
            {isWindowed ? (
              <>
                <input
                  type="datetime-local"
                  value={overrideForm.startsAt}
                  onChange={e => setOverrideForm(f => ({ ...f, startsAt: e.target.value }))}
                  placeholder="Starts At"
                  style={{ padding: '6px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
                />
                <input
                  type="datetime-local"
                  value={overrideForm.endsAt}
                  onChange={e => setOverrideForm(f => ({ ...f, endsAt: e.target.value }))}
                  placeholder="Ends At"
                  style={{ padding: '6px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
                />
              </>
            ) : (
              <input
                type="datetime-local"
                value={overrideForm.targetCronTime}
                onChange={e => setOverrideForm(f => ({ ...f, targetCronTime: e.target.value }))}
                placeholder="Target Cron Time"
                style={{ padding: '6px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
              />
            )}
            <input
              value={overrideForm.reason}
              onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Reason (optional)"
              style={{ padding: '6px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', flex: 1, minWidth: 160 }}
            />
            <Button size="small" variant="contained" onClick={() => createOverrideMut.mutate()} disabled={createOverrideMut.isPending}>
              Save
            </Button>
            <Button size="small" onClick={() => setAddOverrideOpen(false)} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
          </Box>
        </Paper>
      )}

      {/* Exceptions */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>Scheduled Exceptions</Typography>
          {canEdit && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditingException(undefined); setExceptionOpen(true) }}>
              Add Exception
            </Button>
          )}
        </Box>
        {exceptions && exceptions.length === 0 && (
          <Typography variant="body2" color="text.secondary">No exceptions scheduled.</Typography>
        )}
        {exceptions && exceptions.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Window</TableCell>
                <TableCell>Ticket</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sleep on End</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptions.map(ex => (
                <TableRow key={ex.id}>
                  <TableCell><Chip label={ex.exceptionType} size="small" sx={{ fontSize: 10 }} /></TableCell>
                  <TableCell>{fmtDt(ex.startsAt)} → {fmtDt(ex.endsAt)}</TableCell>
                  <TableCell>{ex.ticketRef || '—'}</TableCell>
                  <TableCell><StatusChip status={ex.status} /></TableCell>
                  <TableCell>{ex.sleepOnEnd ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    {canEdit && ex.status === 'pending' && (
                      <IconButton size="small" onClick={() => { setEditingException(ex); setExceptionOpen(true) }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Execution history */}
      <Box>
        <Typography variant="subtitle1" fontWeight={600} mb={1}>Recent Executions</Typography>
        {!executions && <CircularProgress size={20} />}
        {executions && executions.items.length === 0 && (
          <Typography variant="body2" color="text.secondary">No executions yet.</Typography>
        )}
        {executions && executions.items.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Scaled</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.items.map(ex => {
                const duration = ex.finishedAt
                  ? `${Math.round((new Date(ex.finishedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000)}s`
                  : '—'
                return (
                  <TableRow key={ex.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/policies/${policyId}/executions/${ex.id}`)}>
                    <TableCell>#{ex.id}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {ex.direction === 'sleep'
                          ? <BedtimeIcon sx={{ fontSize: 13, color: '#a5b4fc' }} />
                          : <WbSunnyIcon sx={{ fontSize: 13, color: '#fcd34d' }} />}
                        {ex.direction}
                      </Box>
                    </TableCell>
                    <TableCell>{ex.trigger}</TableCell>
                    <TableCell><StatusChip status={ex.status} /></TableCell>
                    <TableCell>{ex.countScaled}</TableCell>
                    <TableCell>{fmtDt(ex.startedAt)}</TableCell>
                    <TableCell>{duration}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Box>

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
