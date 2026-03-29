'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import { ChipInput } from '@/components/common/ChipInput'
import { AMBER_40, AMBER_03 } from '@/components/guardrails/ProtectedChipInput'
import SaveIcon from '@mui/icons-material/Save'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getGuardrails, updateGuardrails } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canEditGuardrails } from '@/lib/rbac'
import { useSnackbar } from '@/lib/useSnackbar'
import Link from 'next/link'

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

export default function GuardrailsHybridPage() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [expanded, setExpanded] = useState<string | null>(null)
  const [systemNs, setSystemNs] = useState<string[]>([])
  const [skipNsNode, setSkipNsNode] = useState<string[]>([])
  const [skipLabels, setSkipLabels] = useState<string[]>([])
  const [skipTaints, setSkipTaints] = useState<string[]>([])
  const [priorityNs, setPriorityNs] = useState<string[]>([])
  const [evalInterval, setEvalInterval] = useState('30s')
  const [autoWake, setAutoWake] = useState(true)
  const [reconcileWhileAwake, setReconcileWhileAwake] = useState(true)
  const [protectCriticalPodNodes, setProtectCriticalPodNodes] = useState(true)
  const { notify, SnackbarAlert } = useSnackbar()
  const [saveError, setSaveError] = useState<string | null>(null)
  const initialised = useRef(false)

  useEffect(() => {
    if (guardrails && !initialised.current) {
      initialised.current = true
      setSystemNs(splitCommaList(guardrails.systemNamespaces).sort())
      setSkipNsNode(splitCommaList(guardrails.skipNsNode))
      setSkipLabels(splitCommaList(guardrails.skipNodeLabels))
      setSkipTaints(splitCommaList(guardrails.skipNodeTaints))
      setPriorityNs(splitCommaList(guardrails.scalingPriorityNamespaces))
      setEvalInterval(guardrails.schedulerEvalInterval)
      setAutoWake(guardrails.schedulerAutoWake)
      setReconcileWhileAwake(guardrails.schedulerReconcileWhileAwake)
      setProtectCriticalPodNodes(guardrails.protectCriticalPodNodes)
    }
  }, [guardrails])

  const evalIntervalError = validateEvalInterval(evalInterval)
  const evalIntervalValid = !evalIntervalError

  const save = useMutation({
    mutationFn: () => {
      if (!evalIntervalValid) return Promise.reject(new Error(evalIntervalError))
      return updateGuardrails({
        systemNamespaces: joinCommaList(systemNs),
        skipNsNode: joinCommaList(skipNsNode),
        skipNodeLabels: joinCommaList(skipLabels),
        skipNodeTaints: joinCommaList(skipTaints),
        scalingPriorityNamespaces: joinCommaList(priorityNs),
        schedulerEvalInterval: evalInterval.trim(),
        schedulerAutoWake: autoWake,
        schedulerReconcileWhileAwake: reconcileWhileAwake,
        protectCriticalPodNodes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrails'] })
      setSaveError(null)
      notify('Guardrails saved successfully.', 'success')
    },
    onError: (err: unknown) => { setSaveError(formatError(err)) },
  })

  if (isLoading) return <CenteredSpinner />
  if (loadError && !guardrails) return <Alert severity="error">Could not load guardrails.</Alert>

  const toggle = (key: string) => setExpanded(expanded === key ? null : key)
  const nodeRuleCount = (skipNsNode.length > 0 ? 1 : 0) + (skipLabels.length > 0 ? 1 : 0) + (skipTaints.length > 0 ? 1 : 0) + (protectCriticalPodNodes ? 1 : 0)

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/guardrails-redesign" size="small" startIcon={<ArrowBackIcon />} sx={{ minWidth: 0, color: 'text.secondary' }}>
          Back
        </Button>
      </Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Guardrails</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Variant E — Hybrid: D-style card headers with icon boxes and stat pills, B-style accordion interiors
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── 1. System-Protected Namespaces ──────────────────────── */}
        <Card
          variant="outlined"
          sx={{ borderColor: AMBER_40, bgcolor: AMBER_03 }}
        >
          <Box onClick={() => toggle('namespaces')} sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(245,158,11,.08)' }}>
                  <ShieldOutlinedIcon sx={{ color: 'warning.main' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={700} fontSize={14}>System-Protected Namespaces</Typography>
                  <Typography variant="caption" color="text.secondary">Namespaces that are never scaled down</Typography>
                </Box>
                {expanded !== 'namespaces' && (
                  <Chip label={`${systemNs.length} protected`} size="small" sx={{ bgcolor: 'rgba(245,158,11,.12)', color: 'warning.main', fontWeight: 600, fontSize: 11 }} />
                )}
                <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', transform: expanded === 'namespaces' ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
              </Box>
            </CardContent>
          </Box>
          <Collapse in={expanded === 'namespaces'}>
            <Divider sx={{ borderColor: AMBER_40 }} />
            <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Workloads in these namespaces are never scaled down or drained. Only remove an entry if you know what you are doing.
              </Typography>
              <ChipInput
                id="hybrid-chip-system-ns"
                values={systemNs}
                onChange={(v) => setSystemNs([...v].sort())}
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
            </CardContent>
          </Collapse>
        </Card>

        {/* ── 2. Node Protection ──────────────────────────────────── */}
        <Card
          variant="outlined"
        >
          <Box onClick={() => toggle('nodes')} sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <DnsOutlinedIcon sx={{ color: 'text.secondary' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={700} fontSize={14}>Node Protection</Typography>
                  <Typography variant="caption" color="text.secondary">Rules that prevent node draining</Typography>
                </Box>
                {expanded !== 'nodes' && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip label={protectCriticalPodNodes ? 'Critical: ON' : 'Critical: OFF'} size="small" sx={{ fontSize: 11 }} />
                    <Chip label={`${nodeRuleCount} rules`} size="small" sx={{ fontSize: 11 }} />
                  </Box>
                )}
                <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', transform: expanded === 'nodes' ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
              </Box>
            </CardContent>
          </Box>
          <Collapse in={expanded === 'nodes'}>
            <Divider />
            <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Nodes matching these rules will never be drained, even if idle.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>Protect Critical Priority Pods</Typography>
                  <Typography variant="caption" color="text.secondary">Never drain nodes running system-critical pods</Typography>
                </Box>
                <Switch checked={protectCriticalPodNodes} disabled={!hasEdit} onChange={(e) => setProtectCriticalPodNodes(e.target.checked)} />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <ChipInput id="hybrid-chip-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={skipNsNode} onChange={setSkipNsNode} readOnly={!hasEdit} />
                <ChipInput id="hybrid-chip-skip-labels" label="Skip Node Labels" hint="key=value format" values={skipLabels} onChange={setSkipLabels} readOnly={!hasEdit} />
                <ChipInput id="hybrid-chip-skip-taints" label="Skip Node Taints" hint="key=value:effect format" values={skipTaints} onChange={setSkipTaints} readOnly={!hasEdit} />
              </Box>
            </CardContent>
          </Collapse>
        </Card>

        {/* ── 3. Scaling Priority ─────────────────────────────────── */}
        <Card
          variant="outlined"
        >
          <Box onClick={() => toggle('scaling')} sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <SwapVertIcon sx={{ color: 'text.secondary' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={700} fontSize={14}>Scaling Priority</Typography>
                  <Typography variant="caption" color="text.secondary">Wake-up order for namespaces</Typography>
                </Box>
                {expanded !== 'scaling' && (
                  <Chip label={`${priorityNs.length} priority ns`} size="small" sx={{ fontSize: 11 }} />
                )}
                <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', transform: expanded === 'scaling' ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
              </Box>
            </CardContent>
          </Box>
          <Collapse in={expanded === 'scaling'}>
            <Divider />
            <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                These namespaces are scaled first during wake-up, in listed order.
              </Typography>
              <ChipInput id="hybrid-chip-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={priorityNs} onChange={setPriorityNs} readOnly={!hasEdit} />
            </CardContent>
          </Collapse>
        </Card>

        {/* ── 4. Scheduler Behaviour ──────────────────────────────── */}
        <Card
          variant="outlined"
        >
          <Box onClick={() => toggle('scheduler')} sx={{ cursor: 'pointer' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  <ScheduleIcon sx={{ color: 'text.secondary' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={700} fontSize={14}>Scheduler Behaviour</Typography>
                  <Typography variant="caption" color="text.secondary">Evaluation loop configuration</Typography>
                </Box>
                {expanded !== 'scheduler' && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip label={evalInterval} size="small" sx={{ fontSize: 11, fontFamily: 'monospace' }} />
                    <Chip label={autoWake ? 'Wake: ON' : 'Wake: OFF'} size="small" sx={{ fontSize: 11 }} />
                    <Chip label={reconcileWhileAwake ? 'Reconcile: ON' : 'Reconcile: OFF'} size="small" sx={{ fontSize: 11 }} />
                  </Box>
                )}
                <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', transform: expanded === 'scheduler' ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
              </Box>
            </CardContent>
          </Box>
          <Collapse in={expanded === 'scheduler'}>
            <Divider />
            <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Control how the policy evaluation loop runs.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '8px 8px 0 0' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                    <Typography variant="caption" color="text.secondary">How often the scheduler evaluates policy state</Typography>
                  </Box>
                  <TextField size="small" value={evalInterval} disabled={!hasEdit} error={!evalIntervalValid} onChange={(e) => setEvalInterval(e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', textAlign: 'center', width: 64 } } }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Auto Wake</Typography>
                    <Typography variant="caption" color="text.secondary">Automatically wake clusters when outside a sleep window</Typography>
                  </Box>
                  <Switch checked={autoWake} disabled={!hasEdit} onChange={(e) => setAutoWake(e.target.checked)} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: '1px solid', borderColor: 'divider', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Reconcile While Awake</Typography>
                    <Typography variant="caption" color="text.secondary">Re-evaluate policies during awake windows to correct drift</Typography>
                  </Box>
                  <Switch checked={reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setReconcileWhileAwake(e.target.checked)} />
                </Box>
              </Box>
            </CardContent>
          </Collapse>
        </Card>

      </Box>

      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={hasEdit ? '' : 'You do not have permission to edit guardrails'}>
          <span>
            <Button variant="contained" startIcon={save.isPending ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />} disabled={save.isPending || !hasEdit} onClick={() => save.mutate()}>
              Save Guardrails
            </Button>
          </span>
        </Tooltip>
        {saveError && <Alert severity="error" sx={{ py: 0.5 }}>{saveError}</Alert>}
      </Box>
      {SnackbarAlert}
    </>
  )
}
