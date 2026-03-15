'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import SaveIcon from '@mui/icons-material/Save'
import { getGuardrails, updateGuardrails } from '@/lib/api'

function ChipInput({
  label,
  hint,
  values,
  onChange,
}: {
  label: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !values.includes(v)) {
      onChange([...values, v])
    }
    setInput('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
    if (e.key === 'Backspace' && input === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <Box>
      <Typography component="label" htmlFor={`chip-input-${label}`} variant="body2" fontWeight={600} mb={1} display="block">
        {label}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {hint}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.75,
          p: 1.5,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 2,
          minHeight: 52,
          cursor: 'text',
          '&:focus-within': { borderColor: 'primary.main' },
        }}
        onClick={() => document.getElementById(`chip-input-${label}`)?.focus()}
      >
        {values.map((v) => (
          <Chip
            key={v}
            label={v}
            size="small"
            onDelete={() => onChange(values.filter((x) => x !== v))}
            sx={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        ))}
        <input
          id={`chip-input-${label}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length === 0 ? 'Type and press Enter...' : ''}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'inherit',
            fontSize: 13,
            fontFamily: 'inherit',
            minWidth: 140,
            flex: 1,
          }}
        />
      </Box>
    </Box>
  )
}

function csv(arr: string[]) { return arr.join(',') }
function fromCsv(s: string) { return s.split(',').map((v) => v.trim()).filter(Boolean) }

export default function GuardrailsForm() {
  const qc = useQueryClient()
  const { data: g, isLoading, isError: loadError } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  const [skipNs, setSkipNs] = useState<string[]>([])
  const [skipNsNode, setSkipNsNode] = useState<string[]>([])
  const [skipLabels, setSkipLabels] = useState<string[]>([])
  const [skipTaints, setSkipTaints] = useState<string[]>([])
  const [snackOpen, setSnackOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const initialised = useRef(false)

  // Only initialise local state once — when data first loads.
  // Subsequent background refetches do NOT reset the form mid-edit.
  useEffect(() => {
    if (g && !initialised.current) {
      initialised.current = true
      setSkipNs(fromCsv(g.skipNamespaces))
      setSkipNsNode(fromCsv(g.skipNsNode))
      setSkipLabels(fromCsv(g.skipNodeLabels))
      setSkipTaints(fromCsv(g.skipNodeTaints))
    }
  }, [g])

  const save = useMutation({
    mutationFn: () =>
      updateGuardrails({
        skipNamespaces: csv(skipNs),
        skipNsNode: csv(skipNsNode),
        skipNodeLabels: csv(skipLabels),
        skipNodeTaints: csv(skipTaints),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guardrails'] })
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

  if (loadError) {
    return (
      <Alert severity="error">
        Could not load guardrails — please refresh the page.
      </Alert>
    )
  }

  return (
    <>
      <Grid container spacing={3}>
        {/* Workload exclusions */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                Workload Exclusions
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Workloads in these namespaces are never scaled.
              </Typography>
              <ChipInput
                label="Skip Namespaces"
                hint="e.g. kube-system, monitoring"
                values={skipNs}
                onChange={setSkipNs}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Node protection */}
        <Grid item xs={12} md={6}>
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
                  label="Critical Namespaces (protect nodes)"
                  hint="Nodes running pods from these namespaces are never drained"
                  values={skipNsNode}
                  onChange={setSkipNsNode}
                />
                <ChipInput
                  label="Skip Node Labels"
                  hint="key=value format, e.g. karpenter.k8s.aws/ec2nodeclass=default"
                  values={skipLabels}
                  onChange={setSkipLabels}
                />
                <ChipInput
                  label="Skip Node Taints"
                  hint="key=value:effect format, e.g. karpenter-eks-base=true:NoSchedule"
                  values={skipTaints}
                  onChange={setSkipTaints}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Save */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={save.isPending ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              Save Guardrails
            </Button>
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
