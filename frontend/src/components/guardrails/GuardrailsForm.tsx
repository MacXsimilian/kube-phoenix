'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import LabeledSwitch from '@/components/common/LabeledSwitch'
import SaveIcon from '@mui/icons-material/Save'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { getGuardrails, updateGuardrails } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canEditGuardrails } from '@/lib/rbac'

// ── Constants ─────────────────────────────────────────────────────────────────

const AMBER = 'rgb(245,158,11)'
const AMBER_06 = 'rgba(245,158,11,0.06)'
const AMBER_12 = 'rgba(245,158,11,0.12)'
const AMBER_40 = 'rgba(245,158,11,0.40)'
const AMBER_03 = 'rgba(245,158,11,0.03)'

// ── Chip input ────────────────────────────────────────────────────────────────

function ChipInput({
  id,
  label,
  hint,
  values,
  onChange,
  onDelete,
  readOnly = false,
  containerSx,
  chipSx,
}: {
  id: string
  label?: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
  onDelete?: (v: string) => void
  readOnly?: boolean
  containerSx?: Record<string, unknown>
  chipSx?: Record<string, unknown>
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && input === '' && values.length > 0 && !onDelete) onChange(values.slice(0, -1))
  }

  const handleDelete = (v: string) => {
    if (onDelete) onDelete(v)
    else onChange(values.filter((x) => x !== v))
  }

  return (
    <Box>
      {label && (
        <Typography component="label" htmlFor={id} variant="body2" fontWeight={600} mb={1} display="block">
          {label}
        </Typography>
      )}
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {hint}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex', flexWrap: 'wrap', gap: 0.75,
          p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2,
          minHeight: 52, cursor: 'text',
          '&:focus-within': { borderColor: 'primary.main' },
          ...containerSx,
        }}
        onClick={() => document.getElementById(id)?.focus()}
      >
        {values.map((v) => (
          <Chip
            key={v}
            label={v}
            size="small"
            onDelete={readOnly ? undefined : () => handleDelete(v)}
            sx={{ fontFamily: 'monospace', fontSize: 12, ...chipSx }}
          />
        ))}
        {!readOnly && (
          <input
            id={id}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onBlur={add}
            placeholder={values.length === 0 ? 'Type and press Enter...' : ''}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 13, fontFamily: 'inherit', minWidth: 140, flex: 1 }}
          />
        )}
      </Box>
    </Box>
  )
}

// ── Protected chip input — composes ChipInput with confirmation dialog ───────

function ProtectedChipInput({
  values,
  onChange,
  readOnly = false,
}: {
  values: string[]
  onChange: (v: string[]) => void
  readOnly?: boolean
}) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  const confirmRemove = () => {
    if (pendingRemove) onChange(values.filter((x) => x !== pendingRemove))
    setPendingRemove(null)
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <ShieldOutlinedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="body2" fontWeight={600}>System-Protected Namespaces</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
        Always-on namespaces. Only remove an entry if you know what you're doing.
      </Typography>

      <ChipInput
        id="protected-chip-input"
        values={values}
        onChange={(v) => onChange([...v].sort())}
        onDelete={(v) => setPendingRemove(v)}
        readOnly={readOnly}
        containerSx={{
          borderColor: AMBER,
          bgcolor: AMBER_06,
          '&:focus-within': { borderColor: AMBER },
        }}
        chipSx={{
          bgcolor: AMBER_12,
          color: 'warning.main',
          '& .MuiChip-deleteIcon': { color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } },
        }}
      />

      <Dialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon sx={{ color: 'warning.main', fontSize: 22 }} />
          Remove system-protected namespace?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You are about to remove{' '}
            <Box component="span" sx={{ fontFamily: 'monospace', color: 'warning.main', fontWeight: 600 }}>
              {pendingRemove}
            </Box>{' '}
            from the system-protected list. Workloads in this namespace will no longer be excluded from sleep/wake runs.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
            This may affect critical cluster infrastructure. Only proceed if you are certain.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingRemove(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={confirmRemove}>
            Remove anyway
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function joinCsv(arr: string[]) { return arr.join(',') }
function parseCsv(s: string) { return s.split(',').map((v) => v.trim()).filter(Boolean) }

// ── Main form ─────────────────────────────────────────────────────────────────

export default function GuardrailsForm() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [systemNs, setSystemNs] = useState<string[]>([])
  const [skipNsNode, setSkipNsNode] = useState<string[]>([])
  const [skipLabels, setSkipLabels] = useState<string[]>([])
  const [skipTaints, setSkipTaints] = useState<string[]>([])
  const [priorityNs, setPriorityNs] = useState<string[]>([])
  const [evalInterval, setEvalInterval] = useState('30s')
  const [autoWake, setAutoWake] = useState(true)
  const [reconcileWhileAwake, setReconcileWhileAwake] = useState(true)
  const [snackOpen, setSnackOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const initialised = useRef(false)

  useEffect(() => {
    if (guardrails && !initialised.current) {
      initialised.current = true
      setSystemNs(parseCsv(guardrails.systemNamespaces).sort())
      setSkipNsNode(parseCsv(guardrails.skipNsNode))
      setSkipLabels(parseCsv(guardrails.skipNodeLabels))
      setSkipTaints(parseCsv(guardrails.skipNodeTaints))
      setPriorityNs(parseCsv(guardrails.scalingPriorityNamespaces))
      setEvalInterval(guardrails.schedulerEvalInterval)
      setAutoWake(guardrails.schedulerAutoWake)
      setReconcileWhileAwake(guardrails.schedulerReconcileWhileAwake)
    }
  }, [guardrails])

  const evalIntervalError = /^\d+(ns|us|µs|ms|s|m|h)$/.test(evalInterval.trim())
    ? ''
    : 'Must be a valid duration (e.g. 30s, 1m, 2m)'

  const save = useMutation({
    mutationFn: () => {
      if (evalIntervalError) return Promise.reject(new Error(evalIntervalError))
      return updateGuardrails({
        systemNamespaces: joinCsv(systemNs),
        skipNsNode: joinCsv(skipNsNode),
        skipNodeLabels: joinCsv(skipLabels),
        skipNodeTaints: joinCsv(skipTaints),
        scalingPriorityNamespaces: joinCsv(priorityNs),
        schedulerEvalInterval: evalInterval.trim(),
        schedulerAutoWake: autoWake,
        schedulerReconcileWhileAwake: reconcileWhileAwake,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setSaveError(null)
      setSnackOpen(true)
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Failed to save guardrails')
    },
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (loadError && !guardrails) {
    return <Alert severity="error">Could not load guardrails — please refresh the page.</Alert>
  }

  return (
    <>
      <Grid container spacing={3}>
        {loadError && guardrails && (
          <Grid size={12}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              Could not refresh guardrails — showing last known values.
            </Alert>
          </Grid>
        )}
        {/* System-protected namespaces — full width, visually distinct */}
        <Grid size={12}>
          <Card sx={{ border: '1px solid', borderColor: AMBER_40, bgcolor: AMBER_03 }}>
            <CardContent sx={{ p: 3 }}>
              <ProtectedChipInput values={systemNs} onChange={setSystemNs} readOnly={!hasEdit} />
            </CardContent>
          </Card>
        </Grid>

        {/* Node protection */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                Node Protection
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Nodes will not be drained if any of the following conditions match.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <ChipInput
                  id="chip-input-critical-ns"
                  label="Critical Namespaces (protect nodes)"
                  hint="Nodes running pods from these namespaces are never drained"
                  values={skipNsNode}
                  onChange={setSkipNsNode}
                  readOnly={!hasEdit}
                />
                <ChipInput
                  id="chip-input-skip-labels"
                  label="Skip Node Labels"
                  hint="key=value format, e.g. karpenter.k8s.aws/ec2nodeclass=default"
                  values={skipLabels}
                  onChange={setSkipLabels}
                  readOnly={!hasEdit}
                />
                <ChipInput
                  id="chip-input-skip-taints"
                  label="Skip Node Taints"
                  hint="key=value:effect format, e.g. karpenter-eks-base=true:NoSchedule"
                  values={skipTaints}
                  onChange={setSkipTaints}
                  readOnly={!hasEdit}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Scaling priority + Scheduler — stacked in right column */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                  Scaling Priority
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2.5}>
                  Scale these namespaces first, in listed order.
                </Typography>
                <ChipInput
                  id="chip-input-priority-ns"
                  label="Priority Namespaces"
                  hint="Add namespaces in the order they should be scaled"
                  values={priorityNs}
                  onChange={setPriorityNs}
                  readOnly={!hasEdit}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                  Scheduler Behaviour
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2.5}>
                  Control how the policy evaluation loop runs.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ maxWidth: 200 }}>
                    <TextField
                      label="Eval Interval"
                      size="small"
                      fullWidth
                      value={evalInterval}
                      disabled={!hasEdit}
                      error={!!evalIntervalError}
                      helperText={evalIntervalError || 'How often policies are checked (e.g. 30s, 1m)'}
                      onChange={(e) => setEvalInterval(e.target.value)}
                      slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                    />
                  </Box>
                  <LabeledSwitch
                    label="Auto Wake"
                    description="Automatically wake clusters when outside a sleep window. Disable for sleep-only mode."
                    checked={autoWake}
                    disabled={!hasEdit}
                    onChange={setAutoWake}
                  />
                  <LabeledSwitch
                    label="Reconcile While Awake"
                    description="Keep evaluating policies during awake windows. Disable to skip checks between sleep windows."
                    checked={reconcileWhileAwake}
                    disabled={!hasEdit}
                    onChange={setReconcileWhileAwake}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* Save */}
        <Grid size={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title={hasEdit ? '' : 'You do not have permission to edit guardrails'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={save.isPending ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                  disabled={save.isPending || !hasEdit}
                  onClick={() => save.mutate()}
                >
                  Save Guardrails
                </Button>
              </span>
            </Tooltip>
            {saveError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {saveError}
              </Alert>
            )}
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" onClose={() => setSnackOpen(false)} sx={{ width: '100%' }}>
          Guardrails saved successfully.
        </Alert>
      </Snackbar>
    </>
  )
}
