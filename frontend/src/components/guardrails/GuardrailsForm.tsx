'use client'

import { useState, useEffect, useRef, useReducer } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ScheduleIcon from '@mui/icons-material/Schedule'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import { ChipInput } from '@/components/common/ChipInput'
import CategoryCard from '@/components/guardrails/CategoryCard'
import { AMBER_40, AMBER_03 } from '@/components/guardrails/ProtectedChipInput'
import SaveIcon from '@mui/icons-material/Save'
import { getGuardrails, updateGuardrails } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canEditGuardrails } from '@/lib/rbac'
import { useSnackbar } from '@/lib/useSnackbar'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'

// ── Constants ────────────────────────────────────────────────────────────────

const SECTION = {
  NAMESPACES: 'namespaces',
  NODES: 'nodes',
  SCALING: 'scaling',
  SCHEDULER: 'scheduler',
} as const

type Section = typeof SECTION[keyof typeof SECTION]

// ── Helpers ──────────────────────────────────────────────────────────────────

function joinCommaList(arr: string[]) { return arr.join(',') }
function splitCommaList(s: string) { return s.split(',').map((v) => v.trim()).filter(Boolean) }

function validateEvalInterval(value: string): string | undefined {
  const v = value.trim()
  if (!/^(\d+(s|m))+$/.test(v)) return 'Must be a valid duration (e.g. 30s, 1m, 2m)'
  const min = v.match(/(\d+)m/)?.[1] ? Number(v.match(/(\d+)m/)![1]) * 60 : 0
  const s = v.match(/(\d+)s/)?.[1] ? Number(v.match(/(\d+)s/)![1]) : 0
  const total = min + s
  if (total < 10) return 'Must be at least 10s'
  if (total > 900) return 'Must not exceed 15m'
  return undefined
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  systemNs: string[]
  skipNsNode: string[]
  skipLabels: string[]
  skipTaints: string[]
  priorityNs: string[]
  scalingConcurrency: number
  evalInterval: string
  autoWake: boolean
  reconcileWhileAwake: boolean
  enforceSleep: boolean
  protectCriticalPodNodes: boolean
}

const INITIAL_FORM: FormState = {
  systemNs: [],
  skipNsNode: [],
  skipLabels: [],
  skipTaints: [],
  priorityNs: [],
  scalingConcurrency: 10,
  evalInterval: '30s',
  autoWake: true,
  reconcileWhileAwake: true,
  enforceSleep: true,
  protectCriticalPodNodes: true,
}

type FormAction =
  | { type: 'SET'; payload: FormState }
  | { type: 'SET_FIELD'; field: keyof FormState; value: FormState[keyof FormState] }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET': return action.payload
    case 'SET_FIELD': return { ...state, [action.field]: action.value }
  }
}

interface Snapshot {
  systemNs: string
  skipNsNode: string
  skipLabels: string
  skipTaints: string
  priorityNs: string
  scalingConcurrency: number
  evalInterval: string
  autoWake: boolean
  reconcileWhileAwake: boolean
  enforceSleep: boolean
  protectCriticalPodNodes: boolean
}

function buildSnapshot(form: FormState): Snapshot {
  return {
    systemNs: joinCommaList(form.systemNs),
    skipNsNode: joinCommaList(form.skipNsNode),
    skipLabels: joinCommaList(form.skipLabels),
    skipTaints: joinCommaList(form.skipTaints),
    priorityNs: joinCommaList(form.priorityNs),
    scalingConcurrency: form.scalingConcurrency,
    evalInterval: form.evalInterval.trim(),
    autoWake: form.autoWake,
    reconcileWhileAwake: form.reconcileWhileAwake,
    enforceSleep: form.enforceSleep,
    protectCriticalPodNodes: form.protectCriticalPodNodes,
  }
}

function isDirty(form: FormState, snapshot: Snapshot): boolean {
  const current = buildSnapshot(form)
  return (Object.keys(current) as (keyof Snapshot)[]).some(
    (key) => current[key] !== snapshot[key],
  )
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function GuardrailsForm() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [expanded, setExpanded] = useState<Section | null>(null)
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM)
  const { notify, SnackbarAlert } = useSnackbar()
  const { setDirty } = useUnsavedChanges()
  const [saveError, setSaveError] = useState<string | null>(null)
  const initialised = useRef(false)
  const savedSnapshot = useRef<Snapshot>(buildSnapshot(INITIAL_FORM))

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    dispatch({ type: 'SET_FIELD', field, value })

  useEffect(() => {
    if (guardrails && !initialised.current) {
      initialised.current = true
      const loaded: FormState = {
        systemNs: splitCommaList(guardrails.systemNamespaces).sort(),
        skipNsNode: splitCommaList(guardrails.skipNsNode),
        skipLabels: splitCommaList(guardrails.skipNodeLabels),
        skipTaints: splitCommaList(guardrails.skipNodeTaints),
        priorityNs: splitCommaList(guardrails.scalingPriorityNamespaces),
        scalingConcurrency: guardrails.scalingConcurrency,
        evalInterval: guardrails.schedulerEvalInterval,
        autoWake: guardrails.schedulerAutoWake,
        reconcileWhileAwake: guardrails.schedulerReconcileWhileAwake,
        enforceSleep: guardrails.schedulerEnforceSleep,
        protectCriticalPodNodes: guardrails.protectCriticalPodNodes,
      }
      dispatch({ type: 'SET', payload: loaded })
      savedSnapshot.current = buildSnapshot(loaded)
    }
  }, [guardrails])

  useEffect(() => {
    setDirty(isDirty(form, savedSnapshot.current))
  }, [form, setDirty])

  useEffect(() => () => setDirty(false), [setDirty])

  const evalIntervalError = validateEvalInterval(form.evalInterval)
  const evalIntervalValid = !evalIntervalError

  const save = useMutation({
    mutationFn: () => {
      if (!evalIntervalValid) return Promise.reject(new Error(evalIntervalError))
      const snapshot = buildSnapshot(form)
      return updateGuardrails({
        systemNamespaces: snapshot.systemNs,
        skipNsNode: snapshot.skipNsNode,
        skipNodeLabels: snapshot.skipLabels,
        skipNodeTaints: snapshot.skipTaints,
        scalingPriorityNamespaces: snapshot.priorityNs,
        scalingConcurrency: snapshot.scalingConcurrency,
        schedulerEvalInterval: snapshot.evalInterval,
        schedulerAutoWake: snapshot.autoWake,
        schedulerReconcileWhileAwake: snapshot.reconcileWhileAwake,
        schedulerEnforceSleep: snapshot.enforceSleep,
        protectCriticalPodNodes: snapshot.protectCriticalPodNodes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setSaveError(null)
      savedSnapshot.current = buildSnapshot(form)
      setDirty(false)
      notify('Guardrails saved successfully.', 'success')
    },
    onError: (err: unknown) => {
      setSaveError(formatError(err))
    },
  })

  if (isLoading) {
    return <CenteredSpinner />
  }

  if (loadError && !guardrails) {
    return <Alert severity="error">Could not load guardrails — please refresh the page.</Alert>
  }

  const toggle = (key: Section) => setExpanded(expanded === key ? null : key)

  const nodeRuleCount =
    (form.skipNsNode.length > 0 ? 1 : 0) +
    (form.skipLabels.length > 0 ? 1 : 0) +
    (form.skipTaints.length > 0 ? 1 : 0) +
    (form.protectCriticalPodNodes ? 1 : 0)

  return (
    <>
      {loadError && guardrails && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not refresh guardrails — showing last known values.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── 1. System-Protected Namespaces ──────────────────────── */}
        <CategoryCard
          icon={<ShieldOutlinedIcon sx={{ color: 'warning.main' }} />}
          title="System-Protected Namespaces"
          subtitle="Namespaces that are never scaled down"
          expanded={expanded === SECTION.NAMESPACES}
          onToggle={() => toggle(SECTION.NAMESPACES)}
          pills={
            <Chip label={`${form.systemNs.length} protected`} size="small" sx={{ bgcolor: 'rgba(245,158,11,.12)', color: 'warning.main', fontWeight: 600, fontSize: 11 }} />
          }
          cardSx={{ borderColor: AMBER_40, bgcolor: AMBER_03 }}
          dividerSx={{ borderColor: AMBER_40 }}
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Workloads in these namespaces are never scaled down or drained. Only remove an entry if you know what you are doing.
          </Typography>
          <ChipInput
            id="chip-input-system-ns"
            values={form.systemNs}
            onChange={(v) => setField('systemNs', [...v].sort())}
            readOnly={!hasEdit}
            containerSx={{
              borderColor: AMBER_40,
              bgcolor: 'rgba(245,158,11,0.06)',
              '&:focus-within': { borderColor: AMBER_40 },
            }}
            chipSx={{
              bgcolor: 'rgba(245,158,11,0.12)',
              color: 'warning.main',
              '& .MuiChip-deleteIcon': { color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } },
            }}
          />
        </CategoryCard>

        {/* ── 2. Node Protection ──────────────────────────────────── */}
        <CategoryCard
          icon={<DnsOutlinedIcon sx={{ color: 'text.secondary' }} />}
          title="Node Protection"
          subtitle="Rules that prevent node draining"
          expanded={expanded === SECTION.NODES}
          onToggle={() => toggle(SECTION.NODES)}
          pills={
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip label={form.protectCriticalPodNodes ? 'Critical: ON' : 'Critical: OFF'} size="small" sx={{ fontSize: 11 }} />
              <Chip label={`${nodeRuleCount} rules`} size="small" sx={{ fontSize: 11 }} />
            </Box>
          }
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Nodes matching these rules will never be drained, even if idle.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>Protect Critical Priority Pods</Typography>
              <Typography variant="caption" color="text.secondary">Never drain nodes running system-critical pods</Typography>
            </Box>
            <Switch checked={form.protectCriticalPodNodes} disabled={!hasEdit} onChange={(e) => setField('protectCriticalPodNodes', e.target.checked)} />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <ChipInput id="chip-input-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={form.skipNsNode} onChange={(v) => setField('skipNsNode', v)} readOnly={!hasEdit} />
            <ChipInput id="chip-input-skip-labels" label="Skip Node Labels" hint="key=value format, e.g. karpenter.k8s.aws/ec2nodeclass=default" values={form.skipLabels} onChange={(v) => setField('skipLabels', v)} readOnly={!hasEdit} />
            <ChipInput id="chip-input-skip-taints" label="Skip Node Taints" hint="key=value:effect format, e.g. karpenter-eks-base=true:NoSchedule" values={form.skipTaints} onChange={(v) => setField('skipTaints', v)} readOnly={!hasEdit} />
          </Box>
        </CategoryCard>

        {/* ── 3. Scaling Priority ─────────────────────────────────── */}
        <CategoryCard
          icon={<SwapVertIcon sx={{ color: 'text.secondary' }} />}
          title="Scaling Priority"
          subtitle="Wake-up order for namespaces"
          expanded={expanded === SECTION.SCALING}
          onToggle={() => toggle(SECTION.SCALING)}
          pills={
            <Chip label={`${form.priorityNs.length} priority ns`} size="small" sx={{ fontSize: 11 }} />
          }
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            These namespaces are scaled first during wake-up, in listed order.
          </Typography>
          <ChipInput id="chip-input-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={form.priorityNs} onChange={(v) => setField('priorityNs', v)} readOnly={!hasEdit} />
        </CategoryCard>

        {/* ── 4. Scheduler Behaviour ──────────────────────────────── */}
        <CategoryCard
          icon={<ScheduleIcon sx={{ color: 'text.secondary' }} />}
          title="Scheduler Behaviour"
          subtitle="Evaluation loop configuration"
          expanded={expanded === SECTION.SCHEDULER}
          onToggle={() => toggle(SECTION.SCHEDULER)}
          pills={
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip label={form.evalInterval} size="small" sx={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Chip label={form.autoWake ? 'Wake: ON' : 'Wake: OFF'} size="small" sx={{ fontSize: 11 }} />
              <Chip label={form.reconcileWhileAwake ? 'Reconcile: ON' : 'Reconcile: OFF'} size="small" sx={{ fontSize: 11 }} />
              <Chip label={form.enforceSleep ? 'Enforce: ON' : 'Enforce: OFF'} size="small" sx={{ fontSize: 11 }} />
            </Box>
          }
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Control how the policy evaluation loop runs.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '8px 8px 0 0' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Scaling Concurrency</Typography>
                <Typography variant="caption" color="text.secondary">Max workloads scaled in parallel during sleep/wake (1–50)</Typography>
              </Box>
              <TextField size="small" type="number" value={form.scalingConcurrency} disabled={!hasEdit} error={form.scalingConcurrency < 1 || form.scalingConcurrency > 50} onChange={(e) => setField('scalingConcurrency', Math.max(1, Math.min(50, Number(e.target.value) || 1)))} slotProps={{ htmlInput: { min: 1, max: 50, style: { fontFamily: 'monospace', textAlign: 'center', width: 64 } } }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                <Typography variant="caption" color="text.secondary">How often the scheduler evaluates policy state</Typography>
              </Box>
              <TextField size="small" value={form.evalInterval} disabled={!hasEdit} error={!evalIntervalValid} onChange={(e) => setField('evalInterval', e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', textAlign: 'center', width: 64 } } }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Auto Wake</Typography>
                <Typography variant="caption" color="text.secondary">Automatically wake clusters when outside a sleep window</Typography>
              </Box>
              <Switch checked={form.autoWake} disabled={!hasEdit} onChange={(e) => setField('autoWake', e.target.checked)} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Reconcile While Awake</Typography>
                <Typography variant="caption" color="text.secondary">Re-evaluate policies during awake windows to correct drift</Typography>
              </Box>
              <Switch checked={form.reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setField('reconcileWhileAwake', e.target.checked)} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>Enforce Sleep</Typography>
                <Typography variant="caption" color="text.secondary">When enabled, workloads manually scaled up during a sleep window are automatically scaled back to zero</Typography>
              </Box>
              <Switch checked={form.enforceSleep} disabled={!hasEdit} onChange={(e) => setField('enforceSleep', e.target.checked)} />
            </Box>
          </Box>
        </CategoryCard>

      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
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

      {SnackbarAlert}
    </>
  )
}
