'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { queryKeys } from '@/lib/queryKeys'
import { formatError, fmtDt } from '@/lib/formatters'
import { windowsToText } from '@/lib/windowUtils'
import type { SleepWindow } from '@/lib/types'
import {
  previewGuardrailsImport, applyGuardrailsImport,
  previewPolicyImport, applyPolicyImport,
  previewExceptionImport, applyExceptionImport,
  type ImportKind,
} from '@/lib/api'

type Resolution = 'overwrite' | 'rename'

interface SleepWindowLite {
  name?: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  allDay: boolean
}

interface PolicyBody {
  name: string
  description?: string
  namespaceFilter?: string
  labelSelector?: string
  timezone?: string
  mode: string
  enabled: boolean
  timeoutMinutes?: number
  sleepWindows?: SleepWindowLite[]
}

interface PolicyPreviewResp {
  status: 'create' | 'conflict'
  existingPolicy?: PolicyBody
  incoming: PolicyBody
  forcedEnabledOff: boolean
  forcedModeToPlan: boolean
  conflictByName?: string
}

interface GuardrailsBody {
  protectedNamespaces: string
  skipNsNode: string
  skipNodeLabels: string
  skipNodeTaints: string
  scalingPriorityNamespaces: string
  schedulerEvalInterval: string
  schedulerAutoWake: boolean
  schedulerReconcileWhileAwake: boolean
  schedulerEnforceSleep: boolean
  scalingConcurrency: number
  wakeWaveSize: number
  wakeWavePauseSeconds: number
  protectCriticalPodNodes: boolean
}

interface GuardrailsPreviewResp {
  status: 'conflict'
  before?: GuardrailsBody
  after: GuardrailsBody
  differs: boolean
}

interface WorkloadTargetLite {
  kind: string
  namespace: string
  name: string
}

interface ExceptionBody {
  policyName: string | null
  exceptionType: string
  startsAt: string
  endsAt: string
  ticketRef?: string
  reason?: string
  sleepOnEnd?: boolean | null
  namespaceFilter?: string
  labelSelector?: string
  workloadTargets?: WorkloadTargetLite[]
}

interface ExceptionPreviewResp {
  status: 'create'
  parentPolicyId?: number | null
  parentPolicyName?: string | null
  incoming: ExceptionBody
}

type PreviewResp = PolicyPreviewResp | GuardrailsPreviewResp | ExceptionPreviewResp | null

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  kind: ImportKind
  onNotify?: (msg: string, severity: 'success' | 'error') => void
}

export default function ImportDialog({ open, onClose, kind, onNotify }: ImportDialogProps) {
  const qc = useQueryClient()
  const [pastedText, setPastedText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResp>(null)
  const [resolution, setResolution] = useState<Resolution>('overwrite')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPastedText('')
      setParseError(null)
      setPreview(null)
      setResolution('overwrite')
      setNewName('')
      setBusy(false)
      setError(null)
    }
  }, [open])

  const parsedPayload = (): unknown | null => {
    try {
      const parsed = JSON.parse(pastedText) as unknown
      setParseError(null)
      return parsed
    } catch (e) {
      setParseError(`Could not parse JSON: ${(e as Error).message}`)
      return null
    }
  }

  const runPreview = async () => {
    const payload = parsedPayload()
    if (payload == null) return
    setBusy(true)
    setError(null)
    try {
      const result = await previewByKind(kind, payload)
      setPreview(result as PreviewResp)
      if (kind === 'policy') {
        setResolution('overwrite')
        setNewName('')
      }
    } catch (err) {
      setError(formatError(err))
    } finally {
      setBusy(false)
    }
  }

  const runApply = async () => {
    const payload = parsedPayload()
    if (payload == null) return
    setBusy(true)
    setError(null)
    try {
      await applyByKind(kind, payload, resolution, newName)
      invalidateAfterImport(qc, kind)
      onNotify?.(successMessage(kind), 'success')
      onClose()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setBusy(false)
    }
  }

  const title = dialogTitle(kind)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {preview == null ? (
          <PasteStep
            kind={kind}
            text={pastedText}
            onTextChange={setPastedText}
            parseError={parseError}
            error={error}
          />
        ) : (
          <PreviewStep
            kind={kind}
            preview={preview}
            resolution={resolution}
            onResolutionChange={setResolution}
            newName={newName}
            onNewNameChange={setNewName}
            error={error}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {preview == null ? (
          <Button
            variant="contained"
            onClick={runPreview}
            disabled={busy || pastedText.trim() === ''}
            startIcon={busy ? <CircularProgress size={14} /> : null}
          >
            Preview
          </Button>
        ) : (
          <>
            <Button onClick={() => setPreview(null)} disabled={busy}>Back</Button>
            <Button
              variant="contained"
              onClick={runApply}
              disabled={busy || (kind === 'policy' && resolution === 'rename' && newName.trim() === '')}
              startIcon={busy ? <CircularProgress size={14} /> : null}
            >
              Apply
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PasteStep({
  kind, text, onTextChange, parseError, error,
}: {
  kind: ImportKind
  text: string
  onTextChange: (v: string) => void
  parseError: string | null
  error: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setReadError(`"${file.name}" is not a .json file`)
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setReadError(`Could not read "${file.name}"`)
    reader.onload = () => {
      setReadError(null)
      onTextChange(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsText(file)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Paste the JSON exported from another environment, or drop a <code>.json</code> file. Schema and kind are verified server-side.
      </Typography>
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) readFile(file)
        }}
        sx={{
          position: 'relative',
          borderRadius: 1,
          outline: dragOver ? '2px dashed' : 'none',
          outlineColor: 'primary.main',
          outlineOffset: -4,
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'background-color 120ms, outline-color 120ms',
        }}
      >
        <TextField
          label={`${kindLabel(kind)} JSON`}
          multiline
          minRows={10}
          maxRows={20}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={`Drop a .json file here, or paste:\n\n{\n  "schemaVersion": 1,\n  "kind": "${kind}",\n  ...\n}`}
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 12 } } }}
          fullWidth
        />
      </Box>
      {readError && <Alert severity="error">{readError}</Alert>}
      {parseError && <Alert severity="error">{parseError}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  )
}

function PreviewStep({
  kind, preview, resolution, onResolutionChange, newName, onNewNameChange, error,
}: {
  kind: ImportKind
  preview: NonNullable<PreviewResp>
  resolution: Resolution
  onResolutionChange: (r: Resolution) => void
  newName: string
  onNewNameChange: (v: string) => void
  error: string | null
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      {kind === 'guardrails' && (
        <GuardrailsPreview preview={preview as GuardrailsPreviewResp} />
      )}
      {kind === 'policy' && (
        <PolicyPreview
          preview={preview as PolicyPreviewResp}
          resolution={resolution}
          onResolutionChange={onResolutionChange}
          newName={newName}
          onNewNameChange={onNewNameChange}
        />
      )}
      {kind === 'exception' && (
        <ExceptionPreview preview={preview as ExceptionPreviewResp} />
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  )
}

function GuardrailsPreview({ preview }: { preview: GuardrailsPreviewResp }) {
  const changes = diffGuardrails(preview.before, preview.after)
  return (
    <>
      {changes.length === 0 ? (
        <Alert severity="success">The pasted guardrails are identical to this environment. Apply will be a no-op.</Alert>
      ) : (
        <Alert severity="info">{changes.length} field{changes.length === 1 ? '' : 's'} will change on overwrite.</Alert>
      )}
      {changes.length > 0 && (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Current</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Incoming</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changes.map((c) => (
                <TableRow key={c.key}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.key}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{formatValue(c.before)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'success.main' }}>{formatValue(c.after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  )
}

function diffGuardrails(before: GuardrailsBody | undefined, after: GuardrailsBody): { key: string; before: unknown; after: unknown }[] {
  if (!before) return Object.entries(after).map(([key, value]) => ({ key, before: undefined, after: value }))
  const keys = Object.keys(after) as (keyof GuardrailsBody)[]
  return keys
    .filter((k) => !Object.is(before[k], after[k]))
    .map((k) => ({ key: k, before: before[k], after: after[k] }))
}

function formatValue(v: unknown): string {
  if (v === '' || v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function PolicyPreview({
  preview, resolution, onResolutionChange, newName, onNewNameChange,
}: {
  preview: PolicyPreviewResp
  resolution: Resolution
  onResolutionChange: (r: Resolution) => void
  newName: string
  onNewNameChange: (v: string) => void
}) {
  const hasConflict = preview.status === 'conflict'
  return (
    <>
      {hasConflict ? (
        <Alert severity="info">A policy named &quot;{preview.conflictByName}&quot; already exists in this environment.</Alert>
      ) : (
        <Alert severity="success">No name collision — a new policy will be created.</Alert>
      )}
      {(preview.forcedEnabledOff || preview.forcedModeToPlan) && (
        <Alert severity="warning">
          On import, the policy is forced to <strong>enabled=false</strong> and <strong>mode=&quot;plan&quot;</strong>. Enable it manually after review.
        </Alert>
      )}
      <PolicySummaryCard
        incoming={preview.incoming}
        existing={preview.existingPolicy}
      />
      {hasConflict && (
        <>
          <RadioGroup value={resolution} onChange={(_, v) => onResolutionChange(v as Resolution)}>
            <FormControlLabel value="overwrite" control={<Radio />} label="Overwrite — replace the existing policy in place" />
            <FormControlLabel value="rename" control={<Radio />} label="Rename — import as a new policy with a different name" />
          </RadioGroup>
          {resolution === 'rename' && (
            <TextField
              label="New policy name"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              fullWidth
              autoFocus
            />
          )}
        </>
      )}
    </>
  )
}

function PolicySummaryCard({ incoming, existing }: { incoming: PolicyBody; existing?: PolicyBody }) {
  const rows: { label: string; incoming: string; existing?: string; forced?: boolean }[] = [
    { label: 'Name', incoming: incoming.name, existing: existing?.name },
    { label: 'Description', incoming: incoming.description || '—', existing: existing?.description || '—' },
    { label: 'Namespace filter', incoming: incoming.namespaceFilter || '—', existing: existing?.namespaceFilter || '—' },
    { label: 'Label selector', incoming: incoming.labelSelector || '—', existing: existing?.labelSelector || '—' },
    { label: 'Timezone', incoming: incoming.timezone || 'UTC', existing: existing?.timezone },
    { label: 'Mode', incoming: 'plan (forced)', existing: existing?.mode, forced: incoming.mode === 'apply' },
    { label: 'Enabled', incoming: 'no (forced)', existing: existing ? (existing.enabled ? 'yes' : 'no') : undefined, forced: incoming.enabled },
    { label: 'Timeout', incoming: incoming.timeoutMinutes ? `${incoming.timeoutMinutes} min` : '—', existing: existing?.timeoutMinutes ? `${existing.timeoutMinutes} min` : '—' },
  ]
  const windows = incoming.sleepWindows ?? []
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Policy details</Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: existing ? '160px 1fr 1fr' : '160px 1fr', gap: '6px 16px' }}>
        {existing && (
          <>
            <Box />
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>Incoming</Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>Existing</Typography>
          </>
        )}
        {rows.map((r) => (
          <PolicyRow key={r.label} {...r} hasExisting={!!existing} />
        ))}
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Sleep windows</Typography>
      {windows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {windows.map((w, i) => (
            <Typography component="li" key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
              {windowOneLine(w)}
            </Typography>
          ))}
        </Box>
      )}
      {windows.length > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {windowsToText(windows as SleepWindow[])}
        </Typography>
      )}
    </Box>
  )
}

function PolicyRow({ label, incoming, existing, forced, hasExisting }: { label: string; incoming: string; existing?: string; forced?: boolean; hasExisting: boolean }) {
  const changed = hasExisting && existing !== undefined && existing !== incoming
  return (
    <>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'monospace', fontSize: 12,
          color: forced ? 'warning.main' : changed ? 'success.main' : 'text.primary',
          fontWeight: changed || forced ? 600 : 400,
        }}
      >
        {incoming}
      </Typography>
      {hasExisting && (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.disabled' }}>
          {existing ?? '—'}
        </Typography>
      )}
    </>
  )
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function windowOneLine(w: SleepWindowLite): string {
  const days = w.daysOfWeek.map((d) => DOW_LABELS[d] ?? '?').join(',')
  const time = w.allDay ? 'all day' : `${w.startTime} → ${w.endTime}`
  const name = w.name ? `${w.name} · ` : ''
  return `${name}${days}  ${time}`
}

function ExceptionPreview({ preview }: { preview: ExceptionPreviewResp }) {
  const ex = preview.incoming
  const targets = ex.workloadTargets ?? []
  const typeLabel = ex.exceptionType === 'stay_awake' ? 'Stay awake' : 'Force sleep'
  const typeColor = ex.exceptionType === 'stay_awake' ? 'success' : 'warning'
  return (
    <>
      <Alert severity="success">
        {preview.parentPolicyName
          ? `Will be created and attached to policy "${preview.parentPolicyName}".`
          : 'Will be created as a freestanding exception (no parent policy).'}
      </Alert>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip label={typeLabel} color={typeColor} size="small" />
          {ex.ticketRef && <Chip label={ex.ticketRef} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />}
          <Chip label={durationLabel(ex.startsAt, ex.endsAt)} size="small" variant="outlined" />
        </Box>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px 16px' }}>
          <ExceptionRow label="Starts at" value={fmtDt(ex.startsAt)} />
          <ExceptionRow label="Ends at" value={fmtDt(ex.endsAt)} />
          <ExceptionRow label="Sleep on end" value={ex.sleepOnEnd ? 'yes' : 'no'} />
          <ExceptionRow label="Reason" value={ex.reason || '—'} />
          <ExceptionRow label="Namespace filter" value={ex.namespaceFilter || '—'} />
          <ExceptionRow label="Label selector" value={ex.labelSelector || '—'} />
        </Box>
        {targets.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Workload targets ({targets.length})
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {targets.map((t, i) => (
                <Typography component="li" key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {t.kind}/{t.namespace}/{t.name}
                </Typography>
              ))}
            </Box>
          </>
        )}
      </Box>
    </>
  )
}

function ExceptionRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{value}</Typography>
    </>
  )
}

function durationLabel(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.round(ms / 60_000)} min`
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`
  return `${Math.round(hours / 24)} d`
}

// ─── Plumbing ────────────────────────────────────────────────────────────────

function dialogTitle(kind: ImportKind): string {
  switch (kind) {
    case 'guardrails': return 'Import Guardrails'
    case 'policy': return 'Import Policy'
    case 'exception': return 'Import Scheduled Exception'
  }
}

function kindLabel(kind: ImportKind): string {
  return dialogTitle(kind).replace(/^Import /, '')
}

function previewByKind(kind: ImportKind, payload: unknown): Promise<unknown> {
  switch (kind) {
    case 'guardrails': return previewGuardrailsImport(payload)
    case 'policy': return previewPolicyImport(payload)
    case 'exception': return previewExceptionImport(payload)
  }
}

function applyByKind(kind: ImportKind, payload: unknown, resolution: Resolution, newName: string): Promise<unknown> {
  switch (kind) {
    case 'guardrails':
      return applyGuardrailsImport({ ...(payload as object), conflictResolution: resolution })
    case 'policy':
      return applyPolicyImport({ ...(payload as object), conflictResolution: resolution, newName })
    case 'exception':
      return applyExceptionImport(payload)
  }
}

function invalidateAfterImport(qc: ReturnType<typeof useQueryClient>, kind: ImportKind) {
  switch (kind) {
    case 'guardrails':
      qc.invalidateQueries({ queryKey: queryKeys.guardrails() })
      break
    case 'policy':
      qc.invalidateQueries({ queryKey: queryKeys.policies() })
      break
    case 'exception':
      qc.invalidateQueries({ queryKey: queryKeys.exceptions() })
      break
  }
}

function successMessage(kind: ImportKind): string {
  switch (kind) {
    case 'guardrails': return 'Guardrails import applied.'
    case 'policy': return 'Policy import applied.'
    case 'exception': return 'Exception import applied.'
  }
}
