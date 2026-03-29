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
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Grid from '@mui/material/Grid'
import Slider from '@mui/material/Slider'
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

export default function GuardrailsAccordionPage() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [expanded, setExpanded] = useState<string | false>('scheduler')
  const [schedVariant, setSchedVariant] = useState<'1' | '2' | '3' | '4'>('1')
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

  const handleAccordion = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false)
  }

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
        Variant B — Accordion: collapsible sections with summary badges
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* 1. System Namespaces */}
        <Accordion
          expanded={expanded === 'namespaces'}
          onChange={handleAccordion('namespaces')}
          sx={{ border: '1px solid', borderColor: AMBER_40, bgcolor: AMBER_03, '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <ShieldOutlinedIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              <Typography fontWeight={700} fontSize={14}>System-Protected Namespaces</Typography>
              <Chip label={`${systemNs.length} namespaces`} size="small" sx={{ ml: 'auto', mr: 1, bgcolor: 'rgba(245,158,11,.12)', color: 'warning.main', fontWeight: 600, fontSize: 11 }} />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              Workloads in these namespaces are never scaled down or drained. Only remove an entry if you know what you are doing.
            </Typography>
            <ChipInput
              id="acc-chip-system-ns"
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
          </AccordionDetails>
        </Accordion>

        {/* 2. Node Protection */}
        <Accordion
          expanded={expanded === 'nodes'}
          onChange={handleAccordion('nodes')}
          sx={{ '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <DnsOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography fontWeight={700} fontSize={14}>Node Protection</Typography>
              <Chip label={`${nodeRuleCount} active rules`} size="small" sx={{ ml: 'auto', mr: 1, fontSize: 11 }} />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
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
              <ChipInput id="acc-chip-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={skipNsNode} onChange={setSkipNsNode} readOnly={!hasEdit} />
              <ChipInput id="acc-chip-skip-labels" label="Skip Node Labels" hint="key=value format" values={skipLabels} onChange={setSkipLabels} readOnly={!hasEdit} />
              <ChipInput id="acc-chip-skip-taints" label="Skip Node Taints" hint="key=value:effect format" values={skipTaints} onChange={setSkipTaints} readOnly={!hasEdit} />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* 3. Scaling Priority */}
        <Accordion
          expanded={expanded === 'scaling'}
          onChange={handleAccordion('scaling')}
          sx={{ '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <SwapVertIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography fontWeight={700} fontSize={14}>Scaling Priority</Typography>
              <Chip label={`${priorityNs.length} namespaces`} size="small" sx={{ ml: 'auto', mr: 1, fontSize: 11 }} />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              These namespaces are scaled first during wake-up, in listed order.
            </Typography>
            <ChipInput id="acc-chip-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={priorityNs} onChange={setPriorityNs} readOnly={!hasEdit} />
          </AccordionDetails>
        </Accordion>

        {/* 4. Scheduler */}
        <Accordion
          expanded={expanded === 'scheduler'}
          onChange={handleAccordion('scheduler')}
          sx={{ '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <ScheduleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography fontWeight={700} fontSize={14}>Scheduler Behaviour</Typography>
              <Chip label={`${evalInterval} interval`} size="small" sx={{ ml: 'auto', mr: 1, fontSize: 11, fontFamily: 'monospace' }} />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Control how the policy evaluation loop runs.
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={schedVariant} onChange={(_, v) => v && setSchedVariant(v)} sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.25, fontSize: 11 } }}>
                <ToggleButton value="1">V1</ToggleButton>
                <ToggleButton value="2">V2</ToggleButton>
                <ToggleButton value="3">V3</ToggleButton>
                <ToggleButton value="4">V4</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* ── V1: 3-column split (original) ─────────────────────── */}
            {schedVariant === '1' && (
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Tooltip title="How often the scheduler evaluates policy state" arrow>
                  <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                    <TextField size="small" value={evalInterval} disabled={!hasEdit} error={!evalIntervalValid} onChange={(e) => setEvalInterval(e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', textAlign: 'center', width: 56 } } }} />
                  </Box>
                </Tooltip>
                <Divider orientation="vertical" flexItem />
                <Tooltip title="Automatically wake clusters when outside a sleep window" arrow>
                  <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Auto Wake</Typography>
                    <Switch checked={autoWake} disabled={!hasEdit} onChange={(e) => setAutoWake(e.target.checked)} />
                  </Box>
                </Tooltip>
                <Divider orientation="vertical" flexItem />
                <Tooltip title="Re-evaluate policies during awake windows" arrow>
                  <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Reconcile</Typography>
                    <Switch checked={reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setReconcileWhileAwake(e.target.checked)} />
                  </Box>
                </Tooltip>
              </Box>
            )}

            {/* ── V2: Stacked rows with label-left, control-right ──── */}
            {schedVariant === '2' && (
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
            )}

            {/* ── V3: Compact grid cards ───────────────────────────── */}
            {schedVariant === '3' && (
              <Grid container spacing={1.5}>
                <Grid size={12}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                      <Chip label={evalIntervalValid ? 'valid' : 'invalid'} size="small" color={evalIntervalValid ? 'success' : 'error'} sx={{ fontSize: 10, height: 20 }} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TextField size="small" value={evalInterval} disabled={!hasEdit} error={!evalIntervalValid} onChange={(e) => setEvalInterval(e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', width: 64 } } }} />
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                        Go duration format (10s – 15m). Controls how often policies are evaluated.
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight={600}>Auto Wake</Typography>
                      <Switch checked={autoWake} disabled={!hasEdit} onChange={(e) => setAutoWake(e.target.checked)} size="small" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Wake clusters automatically outside sleep windows
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover', height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight={600}>Reconcile</Typography>
                      <Switch checked={reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setReconcileWhileAwake(e.target.checked)} size="small" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Re-evaluate during awake windows to correct drift
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* ── V4: Inline key-value style ───────────────────────── */}
            {schedVariant === '4' && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" fontWeight={700} sx={{ width: 140, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Eval Interval</Typography>
                  <TextField variant="standard" size="small" value={evalInterval} disabled={!hasEdit} error={!evalIntervalValid} onChange={(e) => setEvalInterval(e.target.value)} slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 14 } } }} sx={{ width: 80 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Duration between policy evaluations (10s – 15m)</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ width: 140, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Auto Wake</Typography>
                  <Switch checked={autoWake} disabled={!hasEdit} onChange={(e) => setAutoWake(e.target.checked)} size="small" />
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Wake clusters when outside sleep windows</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" fontWeight={700} sx={{ width: 140, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>Reconcile</Typography>
                  <Switch checked={reconcileWhileAwake} disabled={!hasEdit} onChange={(e) => setReconcileWhileAwake(e.target.checked)} size="small" />
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Correct drift during awake windows</Typography>
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
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
