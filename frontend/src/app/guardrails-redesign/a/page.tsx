'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import CenteredSpinner from '@/components/common/CenteredSpinner'
import { ChipInput } from '@/components/common/ChipInput'
import ProtectedChipInput, { AMBER_40, AMBER_03 } from '@/components/guardrails/ProtectedChipInput'
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

export default function GuardrailsTabbedPage() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [tab, setTab] = useState(0)
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

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/guardrails-redesign" size="small" startIcon={<ArrowBackIcon />} sx={{ minWidth: 0, color: 'text.secondary' }}>
          Back
        </Button>
      </Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Guardrails</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Variant A — Tabbed layout: one section visible at a time
      </Typography>

      <Card variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Namespaces" />
          <Tab label="Node Protection" />
          <Tab label="Scaling" />
          <Tab label="Scheduler" />
        </Tabs>

        <CardContent sx={{ p: 3, minHeight: 320 }}>
          {/* Tab 0: Namespaces */}
          {tab === 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                System namespaces are globally protected — workloads here are never scaled down or drained.
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: AMBER_40, bgcolor: AMBER_03, borderRadius: 2, p: 2.5 }}>
                <ProtectedChipInput values={systemNs} onChange={setSystemNs} readOnly={!hasEdit} />
              </Box>
            </Box>
          )}

          {/* Tab 1: Node Protection */}
          {tab === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Nodes matching these rules will never be drained, even if idle.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>Protect Critical Priority Pods</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Never drain nodes running system-node-critical or system-cluster-critical pods
                  </Typography>
                </Box>
                <Switch checked={protectCriticalPodNodes} disabled={!hasEdit} onChange={(e) => setProtectCriticalPodNodes(e.target.checked)} />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <ChipInput id="tab-chip-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={skipNsNode} onChange={setSkipNsNode} readOnly={!hasEdit} />
                <ChipInput id="tab-chip-skip-labels" label="Skip Node Labels" hint="key=value format" values={skipLabels} onChange={setSkipLabels} readOnly={!hasEdit} />
                <ChipInput id="tab-chip-skip-taints" label="Skip Node Taints" hint="key=value:effect format" values={skipTaints} onChange={setSkipTaints} readOnly={!hasEdit} />
              </Box>
            </Box>
          )}

          {/* Tab 2: Scaling */}
          {tab === 2 && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Control the order in which namespaces are scaled during wake-up.
              </Typography>
              <ChipInput id="tab-chip-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={priorityNs} onChange={setPriorityNs} readOnly={!hasEdit} />
            </Box>
          )}

          {/* Tab 3: Scheduler */}
          {tab === 3 && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Configure how the policy evaluation loop runs.
              </Typography>
              <Box sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Tooltip title="How often the scheduler evaluates policy state" arrow>
                  <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Eval Interval</Typography>
                    <TextField
                      size="small" value={evalInterval} disabled={!hasEdit} error={!evalIntervalValid}
                      onChange={(e) => setEvalInterval(e.target.value)}
                      slotProps={{ htmlInput: { style: { fontFamily: 'monospace', textAlign: 'center', width: 56 } } }}
                    />
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
            </Box>
          )}
        </CardContent>
      </Card>

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
