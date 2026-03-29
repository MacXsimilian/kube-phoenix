'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Badge from '@mui/material/Badge'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ScheduleIcon from '@mui/icons-material/Schedule'
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

const sections = [
  { key: 'namespaces', label: 'Namespaces', icon: ShieldOutlinedIcon },
  { key: 'nodes', label: 'Node Rules', icon: DnsOutlinedIcon },
  { key: 'scaling', label: 'Scaling', icon: SwapVertIcon },
  { key: 'scheduler', label: 'Scheduler', icon: ScheduleIcon },
] as const

type Section = typeof sections[number]['key']

export default function GuardrailsSidebarPage() {
  const { user } = useAuth()
  const hasEdit = canEditGuardrails(user?.permissions)
  const queryClient = useQueryClient()
  const { data: guardrails, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [section, setSection] = useState<Section>('namespaces')
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

  const badgeCounts: Record<Section, number> = {
    namespaces: systemNs.length,
    nodes: skipNsNode.length + skipLabels.length + skipTaints.length + (protectCriticalPodNodes ? 1 : 0),
    scaling: priorityNs.length,
    scheduler: 3,
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/guardrails-redesign" size="small" startIcon={<ArrowBackIcon />} sx={{ minWidth: 0, color: 'text.secondary' }}>
          Back
        </Button>
      </Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Guardrails</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Variant C — Sidebar navigation with content pane
      </Typography>

      <Card variant="outlined" sx={{ display: 'flex', minHeight: 440 }}>
        {/* Left nav rail */}
        <Box sx={{ width: 190, borderRight: 1, borderColor: 'divider', bgcolor: 'action.hover', flexShrink: 0 }}>
          <List disablePadding sx={{ py: 1 }}>
            {sections.map((s) => {
              const Icon = s.icon
              return (
                <ListItemButton
                  key={s.key}
                  selected={section === s.key}
                  onClick={() => setSection(s.key)}
                  sx={{ py: 1.5, borderLeft: 3, borderColor: section === s.key ? 'primary.main' : 'transparent' }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Badge badgeContent={badgeCounts[s.key]} color="primary" max={99} sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                      <Icon sx={{ fontSize: 20, color: section === s.key ? 'primary.main' : 'text.secondary' }} />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText primary={s.label} slotProps={{ primary: { fontSize: 13, fontWeight: section === s.key ? 700 : 500 } }} />
                </ListItemButton>
              )
            })}
          </List>
        </Box>

        {/* Content pane */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {section === 'namespaces' && (
            <>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>System-Protected Namespaces</Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Workloads in these namespaces are never scaled down or drained.
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: AMBER_40, bgcolor: AMBER_03, borderRadius: 2, p: 2.5 }}>
                <ProtectedChipInput values={systemNs} onChange={setSystemNs} readOnly={!hasEdit} />
              </Box>
            </>
          )}

          {section === 'nodes' && (
            <>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Node Protection</Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
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
                <ChipInput id="side-chip-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={skipNsNode} onChange={setSkipNsNode} readOnly={!hasEdit} />
                <ChipInput id="side-chip-skip-labels" label="Skip Node Labels" hint="key=value format" values={skipLabels} onChange={setSkipLabels} readOnly={!hasEdit} />
                <ChipInput id="side-chip-skip-taints" label="Skip Node Taints" hint="key=value:effect format" values={skipTaints} onChange={setSkipTaints} readOnly={!hasEdit} />
              </Box>
            </>
          )}

          {section === 'scaling' && (
            <>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Scaling Priority</Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                These namespaces are scaled first during wake-up, in listed order.
              </Typography>
              <ChipInput id="side-chip-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={priorityNs} onChange={setPriorityNs} readOnly={!hasEdit} />
            </>
          )}

          {section === 'scheduler' && (
            <>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>Scheduler Behaviour</Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Control how the policy evaluation loop runs.
              </Typography>
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
            </>
          )}
        </Box>
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
