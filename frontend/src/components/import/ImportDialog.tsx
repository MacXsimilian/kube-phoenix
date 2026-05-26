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
import { queryKeys } from '@/lib/queryKeys'
import { formatError } from '@/lib/formatters'
import {
  previewGuardrailsImport, applyGuardrailsImport,
  previewPolicyImport, applyPolicyImport,
  previewExceptionImport, applyExceptionImport,
  type ImportKind,
} from '@/lib/api'

type Resolution = 'skip' | 'overwrite' | 'rename'

interface PolicyPreviewResp {
  status: 'create' | 'conflict'
  existingPolicy?: { name: string; mode: string; enabled: boolean }
  incoming: { name: string; mode: string; enabled: boolean }
  forcedEnabledOff: boolean
  forcedModeToPlan: boolean
  conflictByName?: string
}

interface GuardrailsPreviewResp {
  status: 'conflict'
  differs: boolean
}

interface ExceptionPreviewResp {
  status: 'create'
  parentPolicyName?: string | null
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
        const policyPreview = result as PolicyPreviewResp
        setResolution(policyPreview.status === 'conflict' ? 'overwrite' : 'overwrite')
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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Paste the JSON exported from another environment. Schema and kind are verified server-side.
      </Typography>
      <TextField
        label={`${kindLabel(kind)} JSON`}
        multiline
        minRows={10}
        maxRows={20}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`{\n  "schemaVersion": 1,\n  "kind": "${kind}",\n  ...\n}`}
        slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 12 } } }}
        fullWidth
      />
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
        <GuardrailsPreview preview={preview as GuardrailsPreviewResp} resolution={resolution} onResolutionChange={onResolutionChange} />
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

function GuardrailsPreview({
  preview, resolution, onResolutionChange,
}: {
  preview: GuardrailsPreviewResp
  resolution: Resolution
  onResolutionChange: (r: Resolution) => void
}) {
  return (
    <>
      <Alert severity={preview.differs ? 'info' : 'success'}>
        {preview.differs
          ? 'The pasted guardrails differ from this environment. Choose how to proceed.'
          : 'The pasted guardrails are identical to this environment. Apply will be a no-op.'}
      </Alert>
      <RadioGroup
        value={resolution}
        onChange={(_, v) => onResolutionChange(v as Resolution)}
      >
        <FormControlLabel value="overwrite" control={<Radio />} label="Overwrite — replace current guardrails" />
        <FormControlLabel value="skip" control={<Radio />} label="Skip — do nothing, just audit the attempt" />
      </RadioGroup>
    </>
  )
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
      {(preview.forcedEnabledOff || preview.forcedModeToPlan) && (
        <Alert severity="warning">
          On import, the policy is forced to <strong>enabled=false</strong> and <strong>mode=plan</strong>. Enable it manually after review.
        </Alert>
      )}
      <Typography variant="body2">
        Policy name: <strong>{preview.incoming.name}</strong>
      </Typography>
      {hasConflict ? (
        <>
          <Alert severity="info">
            A policy named &quot;{preview.conflictByName}&quot; already exists in this environment.
          </Alert>
          <RadioGroup value={resolution} onChange={(_, v) => onResolutionChange(v as Resolution)}>
            <FormControlLabel value="overwrite" control={<Radio />} label="Overwrite — replace the existing policy in place" />
            <FormControlLabel value="rename" control={<Radio />} label="Rename — import as a new policy with a different name" />
            <FormControlLabel value="skip" control={<Radio />} label="Skip — do nothing, just audit the attempt" />
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
      ) : (
        <Alert severity="success">No name collision — a new policy will be created.</Alert>
      )}
    </>
  )
}

function ExceptionPreview({ preview }: { preview: ExceptionPreviewResp }) {
  return (
    <Alert severity="success">
      {preview.parentPolicyName
        ? `Will be created and attached to policy "${preview.parentPolicyName}".`
        : 'Will be created as a freestanding exception (no parent policy).'}
    </Alert>
  )
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
