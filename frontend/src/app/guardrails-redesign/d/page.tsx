'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/formatters'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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

export default function GuardrailsCategoryCardsPage() {
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

  const categories = [
    {
      key: 'namespaces',
      icon: <ShieldOutlinedIcon sx={{ color: 'warning.main' }} />,
      title: 'System-Protected Namespaces',
      subtitle: 'Namespaces that are never scaled down',
      pills: [<Chip key="c" label={`${systemNs.length} protected`} size="small" sx={{ bgcolor: 'rgba(245,158,11,.12)', color: 'warning.main', fontWeight: 600, fontSize: 11 }} />],
      amber: true,
      content: (
        <Box sx={{ border: '1px solid', borderColor: AMBER_40, bgcolor: AMBER_03, borderRadius: 2, p: 2.5 }}>
          <ProtectedChipInput values={systemNs} onChange={setSystemNs} readOnly={!hasEdit} />
        </Box>
      ),
    },
    {
      key: 'nodes',
      icon: <DnsOutlinedIcon sx={{ color: 'text.secondary' }} />,
      title: 'Node Protection',
      subtitle: 'Rules that prevent node draining',
      pills: [
        <Chip key="c" label={protectCriticalPodNodes ? 'Critical: ON' : 'Critical: OFF'} size="small" sx={{ fontSize: 11 }} />,
        <Chip key="n" label={`${skipNsNode.length} ns`} size="small" sx={{ fontSize: 11 }} />,
        <Chip key="l" label={`${skipLabels.length} labels`} size="small" sx={{ fontSize: 11 }} />,
        <Chip key="t" label={`${skipTaints.length} taints`} size="small" sx={{ fontSize: 11 }} />,
      ],
      content: (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>Protect Critical Priority Pods</Typography>
              <Typography variant="caption" color="text.secondary">Never drain nodes running system-critical pods</Typography>
            </Box>
            <Switch checked={protectCriticalPodNodes} disabled={!hasEdit} onChange={(e) => setProtectCriticalPodNodes(e.target.checked)} />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <ChipInput id="card-chip-critical-ns" label="Critical Namespaces (protect nodes)" hint="Nodes running pods from these namespaces are never drained" values={skipNsNode} onChange={setSkipNsNode} readOnly={!hasEdit} />
            <ChipInput id="card-chip-skip-labels" label="Skip Node Labels" hint="key=value format" values={skipLabels} onChange={setSkipLabels} readOnly={!hasEdit} />
            <ChipInput id="card-chip-skip-taints" label="Skip Node Taints" hint="key=value:effect format" values={skipTaints} onChange={setSkipTaints} readOnly={!hasEdit} />
          </Box>
        </>
      ),
    },
    {
      key: 'scaling',
      icon: <SwapVertIcon sx={{ color: 'text.secondary' }} />,
      title: 'Scaling Priority',
      subtitle: 'Wake-up order for namespaces',
      pills: [<Chip key="c" label={`${priorityNs.length} priority ns`} size="small" sx={{ fontSize: 11 }} />],
      content: (
        <ChipInput id="card-chip-priority-ns" label="Priority Namespaces" hint="Add namespaces in the order they should be scaled" values={priorityNs} onChange={setPriorityNs} readOnly={!hasEdit} />
      ),
    },
    {
      key: 'scheduler',
      icon: <ScheduleIcon sx={{ color: 'text.secondary' }} />,
      title: 'Scheduler Behaviour',
      subtitle: 'Evaluation loop configuration',
      pills: [
        <Chip key="i" label={evalInterval} size="small" sx={{ fontSize: 11, fontFamily: 'monospace' }} />,
        <Chip key="w" label={autoWake ? 'Wake: ON' : 'Wake: OFF'} size="small" sx={{ fontSize: 11 }} />,
        <Chip key="r" label={reconcileWhileAwake ? 'Reconcile: ON' : 'Reconcile: OFF'} size="small" sx={{ fontSize: 11 }} />,
      ],
      content: (
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
      ),
    },
  ]

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button component={Link} href="/guardrails-redesign" size="small" startIcon={<ArrowBackIcon />} sx={{ minWidth: 0, color: 'text.secondary' }}>
          Back
        </Button>
      </Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Guardrails</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Variant D — Category cards with stat pills, click to expand inline
      </Typography>

      <Grid container spacing={2}>
        {categories.map((cat) => {
          const isExpanded = expanded === cat.key
          return (
            <Grid key={cat.key} size={12}>
              <Card
                variant="outlined"
                sx={{
                  transition: 'all .2s',
                  ...(cat.amber ? { borderColor: AMBER_40, bgcolor: AMBER_03 } : {}),
                  ...(isExpanded ? { borderColor: 'primary.main' } : {}),
                }}
              >
                <CardActionArea onClick={() => toggle(cat.key)} sx={{ p: 0 }}>
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: cat.amber ? 'rgba(245,158,11,.08)' : 'action.hover' }}>
                        {cat.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" fontWeight={700} fontSize={14}>{cat.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{cat.subtitle}</Typography>
                      </Box>
                      <IconButton size="small" sx={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '.2s' }}>
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {!isExpanded && (
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
                        {cat.pills}
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
                <Collapse in={isExpanded}>
                  <Divider />
                  <CardContent sx={{ p: 2.5 }}>
                    {cat.content}
                  </CardContent>
                </Collapse>
              </Card>
            </Grid>
          )
        })}
      </Grid>

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
