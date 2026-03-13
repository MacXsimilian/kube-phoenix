'use client'

import { useState, useEffect, KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { policiesApi, getGuardrails } from '@/lib/api'
import type { SleepPolicy, PolicyInput, PolicyWindowInput, PolicyGuardrailsInput } from '@/lib/types'

const TIMEZONES = [
  'UTC',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Zurich',
  'Europe/Budapest', 'Europe/Warsaw', 'Europe/Prague', 'Europe/Vienna',
  'Europe/Athens', 'Europe/Helsinki', 'Europe/Stockholm',
  'Europe/Moscow', 'Europe/Istanbul',
  'America/New_York', 'America/Toronto',
  'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'America/Mexico_City', 'America/Bogota',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Seoul',
  'Africa/Cairo', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Lagos',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland',
]

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

// ── ChipInput ──────────────────────────────────────────────────────────────────

function ChipInput({
  label,
  placeholder,
  hint,
  values,
  onChange,
  id,
}: {
  label?: string
  placeholder?: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
  id: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && input === '' && values.length > 0) onChange(values.slice(0, -1))
  }

  return (
    <Box>
      {label && (
        <Typography component="label" htmlFor={id} variant="body2" fontWeight={600} mb={0.5} display="block">
          {label}
        </Typography>
      )}
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
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
          minHeight: 48,
          cursor: 'text',
          '&:focus-within': { borderColor: 'primary.main' },
        }}
        onClick={() => document.getElementById(id)?.focus()}
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
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={values.length === 0 ? (placeholder ?? 'Type and press Enter...') : ''}
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

// ── WindowForm ─────────────────────────────────────────────────────────────────

interface WindowFormValue {
  daysOfWeek: string[]
  sleepAt: string
  autoWake: boolean
  wakeAt: string
  advancedOpen: boolean
  dateRangeFrom: string
  dateRangeTo: string
  dateRanges: { from: string; to: string }[]
  exceptions: string[]
}

function buildWindowPreview(w: WindowFormValue, timezone: string): string {
  const days = w.daysOfWeek.length === 7 ? 'Every day'
    : w.daysOfWeek.length === 5 && ['mon','tue','wed','thu','fri'].every((d) => w.daysOfWeek.includes(d)) ? 'Mon\u2013Fri'
    : w.daysOfWeek.map((d) => DAY_LABELS[d] ?? d).join(', ')

  let str = `Sleeps ${days} at ${w.sleepAt || '??:??'} ${timezone}`
  if (w.autoWake && w.wakeAt) {
    const isOvernight = w.wakeAt < w.sleepAt
    str += `, wakes at ${w.wakeAt}${isOvernight ? ' (+1 day)' : ''}`
  } else {
    str += ', manual wake'
  }
  return str
}

function WindowForm({
  value,
  onChange,
  onRemove,
  canRemove,
  timezone,
  index,
}: {
  value: WindowFormValue
  onChange: (v: WindowFormValue) => void
  onRemove: () => void
  canRemove: boolean
  timezone: string
  index: number
}) {
  function set<K extends keyof WindowFormValue>(key: K, val: WindowFormValue[K]) {
    onChange({ ...value, [key]: val })
  }

  function toggleDay(day: string) {
    const next = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day]
    set('daysOfWeek', next)
  }

  const isOvernight = value.autoWake && value.wakeAt && value.wakeAt < value.sleepAt

  return (
    <Box
      sx={{
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 2,
        p: 2,
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" fontWeight={600} color="text.secondary">
          Window {index + 1}
        </Typography>
        {canRemove && (
          <Tooltip title="Remove window">
            <IconButton size="small" onClick={onRemove} aria-label="Remove window">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Day picker */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
          Days of week
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
          {DAYS.map((day) => (
            <Button
              key={day}
              size="small"
              variant={value.daysOfWeek.includes(day) ? 'contained' : 'outlined'}
              onClick={() => toggleDay(day)}
              sx={{
                minWidth: 44,
                px: 0.75,
                fontSize: 11,
                borderColor: 'rgba(255,255,255,0.15)',
                ...(value.daysOfWeek.includes(day)
                  ? {}
                  : { color: 'text.secondary' }),
              }}
            >
              {DAY_LABELS[day]}
            </Button>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => set('daysOfWeek', ['mon','tue','wed','thu','fri'])}
            sx={{ fontSize: 11, color: 'text.secondary', p: 0 }}
          >
            Weekdays
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => set('daysOfWeek', ['sat','sun'])}
            sx={{ fontSize: 11, color: 'text.secondary', p: 0 }}
          >
            Weekends
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => set('daysOfWeek', [...DAYS])}
            sx={{ fontSize: 11, color: 'text.secondary', p: 0 }}
          >
            Every day
          </Button>
        </Box>
      </Box>

      {/* Sleep at */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          label="Sleep at"
          size="small"
          value={value.sleepAt}
          onChange={(e) => set('sleepAt', e.target.value)}
          placeholder="19:00"
          sx={{ width: 120 }}
          inputProps={{ style: { fontFamily: 'monospace' } }}
        />

        {/* Auto-wake toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={value.autoWake}
              onChange={(e) => set('autoWake', e.target.checked)}
              size="small"
              color="primary"
            />
          }
          label={
            <Typography variant="body2">Auto-wake</Typography>
          }
          sx={{ ml: 0 }}
        />

        {/* Wake at */}
        {value.autoWake ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TextField
              label="Wake at"
              size="small"
              value={value.wakeAt}
              onChange={(e) => set('wakeAt', e.target.value)}
              placeholder="06:00"
              sx={{ width: 120 }}
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
            {isOvernight && (
              <Typography variant="caption" color="text.secondary">
                (+1 day)
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Manual wake required
          </Typography>
        )}
      </Box>

      {/* Preview */}
      {value.daysOfWeek.length > 0 && value.sleepAt && (
        <Alert severity="info" sx={{ py: 0.25, mb: 1.5, '& .MuiAlert-message': { fontSize: 12 } }}>
          {buildWindowPreview(value, timezone)}
        </Alert>
      )}

      {/* Advanced rules */}
      <Button
        size="small"
        startIcon={value.advancedOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        onClick={() => set('advancedOpen', !value.advancedOpen)}
        sx={{ color: 'text.secondary', fontSize: 12, p: 0, mb: 0.5 }}
      >
        {value.advancedOpen ? 'Hide' : '＋'} Advanced rules
      </Button>

      <Collapse in={value.advancedOpen}>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Date ranges */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
              Date ranges (active only within these ranges)
            </Typography>
            {value.dateRanges.map((dr, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Chip
                  label={`${dr.from} \u2192 ${dr.to}`}
                  size="small"
                  onDelete={() => set('dateRanges', value.dateRanges.filter((_, j) => j !== i))}
                  sx={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="From (YYYY-MM-DD)"
                value={value.dateRangeFrom}
                onChange={(e) => set('dateRangeFrom', e.target.value)}
                sx={{ width: 160 }}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              />
              <TextField
                size="small"
                placeholder="To (YYYY-MM-DD)"
                value={value.dateRangeTo}
                onChange={(e) => set('dateRangeTo', e.target.value)}
                sx={{ width: 160 }}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              />
              <Button
                size="small"
                variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary', fontSize: 11 }}
                onClick={() => {
                  if (value.dateRangeFrom && value.dateRangeTo) {
                    set('dateRanges', [...value.dateRanges, { from: value.dateRangeFrom, to: value.dateRangeTo }])
                    set('dateRangeFrom', '')
                    set('dateRangeTo', '')
                  }
                }}
              >
                Add
              </Button>
            </Box>
          </Box>

          {/* Exceptions */}
          <ChipInput
            id={`exceptions-${index}`}
            label="Exception dates"
            hint="Specific dates to skip (YYYY-MM-DD)"
            placeholder="2026-12-25"
            values={value.exceptions}
            onChange={(v) => set('exceptions', v)}
          />
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Default values ─────────────────────────────────────────────────────────────

function defaultWindow(): WindowFormValue {
  return {
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    sleepAt: '19:00',
    autoWake: true,
    wakeAt: '06:00',
    advancedOpen: false,
    dateRangeFrom: '',
    dateRangeTo: '',
    dateRanges: [],
    exceptions: [],
  }
}

function windowToFormValue(w: { daysOfWeek: string; sleepAt: string; wakeAt?: string | null; advancedRules?: { dateRanges?: { from: string; to: string }[]; exceptions?: string[] } | null }): WindowFormValue {
  let days: string[] = []
  try { days = JSON.parse(w.daysOfWeek) } catch { days = [] }
  return {
    daysOfWeek: days,
    sleepAt: w.sleepAt,
    autoWake: !!w.wakeAt,
    wakeAt: w.wakeAt ?? '',
    advancedOpen: false,
    dateRangeFrom: '',
    dateRangeTo: '',
    dateRanges: w.advancedRules?.dateRanges ?? [],
    exceptions: w.advancedRules?.exceptions ?? [],
  }
}

function fromCsv(s: string): string[] { return s.split(',').map((v) => v.trim()).filter(Boolean) }
function csv(arr: string[]): string { return arr.join(',') }

interface GuardrailsFormValue {
  skipWorkloads: string[]
  skipNamespaces: string[]
  skipNsNode: string[]
  skipNodeLabels: string[]
  skipNodeTaints: string[]
  minReplicas: number
}

function defaultGuardrails(): GuardrailsFormValue {
  return { skipWorkloads: [], skipNamespaces: [], skipNsNode: [], skipNodeLabels: [], skipNodeTaints: [], minReplicas: 0 }
}

// ── Main dialog ────────────────────────────────────────────────────────────────

export default function PolicyDialog({
  open,
  policy,
  onClose,
}: {
  open: boolean
  policy?: SleepPolicy
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!policy

  // Basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [timezone, setTimezone] = useState('Europe/Budapest')
  const [mode, setMode] = useState<'plan' | 'apply'>('plan')
  const [namespaceFilter, setNamespaceFilter] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [driftCorrectionMode, setDriftCorrectionMode] = useState<'record' | 'silent'>('record')
  const [timeoutMinutes, setTimeoutMinutes] = useState(30)

  // Windows
  const [windows, setWindows] = useState<WindowFormValue[]>([defaultWindow()])

  // Guardrails
  const [guardrailsOpen, setGuardrailsOpen] = useState(false)
  const [guardrails, setGuardrails] = useState<GuardrailsFormValue>(defaultGuardrails())

  // Advanced
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Global guardrails (read-only display)
  const { data: globalGuardrails } = useQuery({ queryKey: ['guardrails'], queryFn: getGuardrails })

  useEffect(() => {
    if (!open) return
    if (policy) {
      setName(policy.name)
      setDescription(policy.description ?? '')
      setTags(policy.tags)
      setTimezone(policy.timezone)
      setMode(policy.mode)
      setNamespaceFilter(policy.namespaceFilter)
      setEnabled(policy.enabled)
      setDriftCorrectionMode(policy.driftCorrectionMode)
      setTimeoutMinutes(policy.timeoutMinutes)
      setWindows(policy.windows.length > 0 ? policy.windows.map(windowToFormValue) : [defaultWindow()])
      if (policy.guardrails) {
        setGuardrails({
          skipWorkloads: fromCsv(policy.guardrails.skipWorkloads),
          skipNamespaces: fromCsv(policy.guardrails.skipNamespaces),
          skipNsNode: fromCsv(policy.guardrails.skipNsNode),
          skipNodeLabels: fromCsv(policy.guardrails.skipNodeLabels),
          skipNodeTaints: fromCsv(policy.guardrails.skipNodeTaints),
          minReplicas: policy.guardrails.minReplicas,
        })
      } else {
        setGuardrails(defaultGuardrails())
      }
    } else {
      setName('')
      setDescription('')
      setTags('')
      setTimezone('Europe/Budapest')
      setMode('plan')
      setNamespaceFilter('')
      setEnabled(false)
      setDriftCorrectionMode('record')
      setTimeoutMinutes(30)
      setWindows([defaultWindow()])
      setGuardrails(defaultGuardrails())
    }
    setGuardrailsOpen(false)
    setAdvancedOpen(false)
  }, [open, policy])

  const mutation = useMutation({
    mutationFn: () => {
      const windowsPayload: PolicyWindowInput[] = windows.map((w) => ({
        daysOfWeek: JSON.stringify(w.daysOfWeek),
        sleepAt: w.sleepAt,
        wakeAt: w.autoWake ? w.wakeAt : null,
        advancedRules: (w.dateRanges.length > 0 || w.exceptions.length > 0)
          ? { dateRanges: w.dateRanges, exceptions: w.exceptions }
          : null,
      }))

      const guardrailsPayload: PolicyGuardrailsInput = {
        skipWorkloads: csv(guardrails.skipWorkloads),
        skipNamespaces: csv(guardrails.skipNamespaces),
        skipNsNode: csv(guardrails.skipNsNode),
        skipNodeLabels: csv(guardrails.skipNodeLabels),
        skipNodeTaints: csv(guardrails.skipNodeTaints),
        minReplicas: guardrails.minReplicas,
      }

      const payload: PolicyInput = {
        name,
        description,
        tags,
        timezone,
        // New policies always start in plan (dry-run) mode; mode is only
        // editable after creation via the ACTIVATION section or card badge.
        mode: isEdit ? mode : 'plan',
        namespaceFilter,
        // New policies are always created enabled; toggled on the card afterwards.
        enabled: isEdit ? enabled : true,
        driftCorrectionMode,
        timeoutMinutes,
        windows: windowsPayload,
        guardrails: guardrailsPayload,
      }

      return isEdit
        ? policiesApi.update(policy!.id, payload)
        : policiesApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      onClose()
    },
  })

  function updateWindow(index: number, value: WindowFormValue) {
    setWindows((ws) => ws.map((w, i) => (i === index ? value : w)))
  }

  function removeWindow(index: number) {
    setWindows((ws) => ws.filter((_, i) => i !== index))
  }

  const guardrailsActiveCount =
    guardrails.skipWorkloads.length +
    guardrails.skipNamespaces.length +
    guardrails.skipNsNode.length +
    guardrails.skipNodeLabels.length +
    guardrails.skipNodeTaints.length +
    (guardrails.minReplicas > 0 ? 1 : 0)

  const isValid = name.trim().length > 0 && windows.every((w) => w.daysOfWeek.length > 0 && w.sleepAt)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper' } }}
    >
      <DialogTitle fontWeight={700}>
        {isEdit ? 'Edit Policy' : 'Add Policy'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0.5 }}>

          {/* ── Basic Info ───────────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
            BASIC INFO
          </Typography>

          <TextField
            label="Name"
            required
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Staging cluster"
          />

          <TextField
            label="Description"
            size="small"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />

          <TextField
            label="Tags"
            size="small"
            fullWidth
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. team-a, staging, non-prod"
            helperText="Comma-separated tags used for conflict detection and grouping."
          />

          <TextField
            select
            label="Timezone"
            size="small"
            fullWidth
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>{tz}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Namespace Filter"
            size="small"
            fullWidth
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            placeholder="e.g. staging, preview"
            helperText="Comma-separated. Empty = all namespaces."
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          {/* ACTIVATION — only shown when editing an existing policy.
              New policies always start in plan mode and enabled. */}
          {isEdit && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
                ACTIVATION
              </Typography>

              <RadioGroup
                value={mode}
                onChange={(e) => setMode(e.target.value as 'plan' | 'apply')}
              >
                <FormControlLabel
                  value="plan"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Plan (dry-run)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Runs simulate changes only — nothing touches the cluster
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="apply"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Apply (live)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Runs make real changes to your cluster
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>

              {mode === 'apply' && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  Apply mode will make real changes to your cluster on the next scheduled run.
                </Alert>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable policy"
              />
            </>
          )}

          <Divider />

          {/* ── Schedule Windows ─────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
              SCHEDULE WINDOWS
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {windows.map((w, i) => (
              <WindowForm
                key={i}
                index={i}
                value={w}
                onChange={(v) => updateWindow(i, v)}
                onRemove={() => removeWindow(i)}
                canRemove={windows.length > 1}
                timezone={timezone}
              />
            ))}
          </Box>

          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            variant="outlined"
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary', alignSelf: 'flex-start' }}
            onClick={() => setWindows((ws) => [...ws, defaultWindow()])}
          >
            Add another window
          </Button>

          <Divider />

          {/* ── Guardrails ───────────────────────────────────────────────── */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => setGuardrailsOpen((v) => !v)}
          >
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ flex: 1 }}>
              GUARDRAILS
            </Typography>
            {guardrailsActiveCount > 0 && (
              <Chip
                label={`${guardrailsActiveCount} active`}
                size="small"
                sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.light' }}
              />
            )}
            <IconButton size="small" aria-label="Toggle guardrails section">
              {guardrailsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Collapse in={guardrailsOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ChipInput
                id="skipWorkloads"
                label="Skip Workloads"
                placeholder="e.g. payments-api, auth-service"
                values={guardrails.skipWorkloads}
                onChange={(v) => setGuardrails((g) => ({ ...g, skipWorkloads: v }))}
              />
              <ChipInput
                id="skipNamespaces"
                label="Skip Namespaces"
                placeholder="e.g. ops, tools"
                values={guardrails.skipNamespaces}
                onChange={(v) => setGuardrails((g) => ({ ...g, skipNamespaces: v }))}
              />
              <TextField
                label="Min Replicas"
                type="number"
                size="small"
                value={guardrails.minReplicas}
                onChange={(e) => setGuardrails((g) => ({ ...g, minReplicas: Number(e.target.value) }))}
                helperText="Keep at least N replicas running instead of scaling to 0"
                inputProps={{ min: 0 }}
                sx={{ width: 160 }}
              />

              <Typography variant="caption" fontWeight={600} color="text.secondary" display="block">
                Node Protection
              </Typography>
              <ChipInput
                id="skipNsNode"
                label="Skip Ns Node"
                hint="Nodes running pods from these namespaces are never drained"
                values={guardrails.skipNsNode}
                onChange={(v) => setGuardrails((g) => ({ ...g, skipNsNode: v }))}
              />
              <ChipInput
                id="skipNodeLabels"
                label="Skip Node Labels"
                placeholder="key=value"
                values={guardrails.skipNodeLabels}
                onChange={(v) => setGuardrails((g) => ({ ...g, skipNodeLabels: v }))}
              />
              <ChipInput
                id="skipNodeTaints"
                label="Skip Node Taints"
                placeholder="key=value:effect"
                values={guardrails.skipNodeTaints}
                onChange={(v) => setGuardrails((g) => ({ ...g, skipNodeTaints: v }))}
              />

              {/* Global guardrails read-only */}
              {globalGuardrails && fromCsv(globalGuardrails.skipNamespaces).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    Inherited from global guardrails (skip namespaces):
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {fromCsv(globalGuardrails.skipNamespaces).map((ns) => (
                      <Chip
                        key={ns}
                        label={ns}
                        size="small"
                        sx={{ fontFamily: 'monospace', fontSize: 11, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Collapse>

          <Divider />

          {/* ── Advanced ────────────────────────────────────────────────── */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ flex: 1 }}>
              ADVANCED
            </Typography>
            <IconButton size="small" aria-label="Toggle advanced section">
              {advancedOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Collapse in={advancedOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>Drift Correction</Typography>
              <RadioGroup
                value={driftCorrectionMode}
                onChange={(e) => setDriftCorrectionMode(e.target.value as 'record' | 'silent')}
              >
                <FormControlLabel
                  value="record"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2">
                      Record corrections in history (default)
                    </Typography>
                  }
                />
                <FormControlLabel
                  value="silent"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2">
                      Correct silently
                    </Typography>
                  }
                />
              </RadioGroup>

              <TextField
                label="Timeout (minutes)"
                type="number"
                size="small"
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                inputProps={{ min: 1 }}
                sx={{ width: 160 }}
                helperText="Max execution time before the run is cancelled"
              />
            </Box>
          </Collapse>

          {/* Mutation error */}
          {mutation.isError && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Failed to save policy'}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || !isValid}
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : undefined}
          onClick={() => mutation.mutate()}
        >
          {isEdit ? 'Save Changes' : 'Create Policy'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
