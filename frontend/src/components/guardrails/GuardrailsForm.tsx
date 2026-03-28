'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import { ChipInput } from '@/components/common/ChipInput'
import ProtectedChipInput, { AMBER_40, AMBER_03 } from '@/components/guardrails/ProtectedChipInput'
import SaveIcon from '@mui/icons-material/Save'
import { getGuardrails, updateGuardrails } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canEditGuardrails } from '@/lib/rbac'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SCALING_CONCURRENCY = 10
const MIN_SCALING_CONCURRENCY = 1
const MAX_SCALING_CONCURRENCY = 50

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
  const [scalingConcurrency, setScalingConcurrency] = useState(DEFAULT_SCALING_CONCURRENCY)
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
      setScalingConcurrency(guardrails.scalingConcurrency ?? DEFAULT_SCALING_CONCURRENCY)
    }
  }, [guardrails])

  const evalIntervalValid = /^(\d+(ns|us|µs|ms|s|m|h))+$/.test(evalInterval.trim())
    && !/^0+(ns|us|µs|ms|s|m|h)$/.test(evalInterval.trim())
  const evalIntervalError = evalIntervalValid ? undefined : 'Must be a valid duration (e.g. 30s, 1m, 2m)'

  const save = useMutation({
    mutationFn: () => {
      if (!evalIntervalValid) return Promise.reject(new Error(evalIntervalError))
      return updateGuardrails({
        systemNamespaces: joinCsv(systemNs),
        skipNsNode: joinCsv(skipNsNode),
        skipNodeLabels: joinCsv(skipLabels),
        skipNodeTaints: joinCsv(skipTaints),
        scalingPriorityNamespaces: joinCsv(priorityNs),
        schedulerEvalInterval: evalInterval.trim(),
        schedulerAutoWake: autoWake,
        schedulerReconcileWhileAwake: reconcileWhileAwake,
        scalingConcurrency,
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
                <Grid container spacing={2}>
                  {/* Eval Interval tile */}
                  <Grid size={6}>
                    <Box sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                      <TextField
                        size="small"
                        fullWidth
                        value={evalInterval}
                        disabled={!hasEdit}
                        error={!evalIntervalValid}
                        onChange={(e) => setEvalInterval(e.target.value)}
                        slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
                      />
                      <Typography variant="caption" color={evalIntervalValid ? 'text.secondary' : 'error'}>
                        {evalIntervalValid ? 'Go duration format, e.g. 30s, 1m' : evalIntervalError}
                      </Typography>
                    </Box>
                  </Grid>
                  {/* Scaling Concurrency tile */}
                  <Grid size={6}>
                    <Box sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Scaling Concurrency</Typography>
                      <TextField
                        size="small"
                        fullWidth
                        type="number"
                        value={scalingConcurrency}
                        disabled={!hasEdit}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (!isNaN(v)) setScalingConcurrency(Math.max(MIN_SCALING_CONCURRENCY, Math.min(MAX_SCALING_CONCURRENCY, v)))
                        }}
                        slotProps={{ htmlInput: { min: MIN_SCALING_CONCURRENCY, max: MAX_SCALING_CONCURRENCY, style: { fontFamily: 'monospace' } } }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        1–50 parallel operations per cycle
                      </Typography>
                    </Box>
                  </Grid>
                  {/* Auto Wake tile */}
                  <Grid size={6}>
                    <Box sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Auto Wake</Typography>
                      <Switch checked={autoWake} disabled={!hasEdit} onChange={(e) => setAutoWake(e.target.checked)} />
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        Wake clusters outside sleep windows
                      </Typography>
                    </Box>
                  </Grid>
                  {/* Reconcile While Awake tile */}
                  <Grid size={6}>
                    <Box sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Reconcile While Awake</Typography>
                      <Switch checked={reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setReconcileWhileAwake(e.target.checked)} />
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        Evaluate policies during awake windows
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
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
