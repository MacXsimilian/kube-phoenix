'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { ChipInput } from '@/components/common/ChipInput'

// ── Amber color constants ────────────────────────────────────────────────────

export const AMBER = 'rgb(245,158,11)'
export const AMBER_06 = 'rgba(245,158,11,0.06)'
export const AMBER_12 = 'rgba(245,158,11,0.12)'
export const AMBER_40 = 'rgba(245,158,11,0.40)'
export const AMBER_03 = 'rgba(245,158,11,0.03)'

// ── Component ────────────────────────────────────────────────────────────────

export interface ProtectedChipInputProps {
  values: string[]
  onChange: (v: string[]) => void
  readOnly?: boolean
}

export default function ProtectedChipInput({
  values,
  onChange,
  readOnly = false,
}: ProtectedChipInputProps) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  const confirmRemove = () => {
    if (pendingRemove) onChange(values.filter((x) => x !== pendingRemove))
    setPendingRemove(null)
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <ShieldOutlinedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="body2" sx={{
          fontWeight: 600
        }}>Protected Namespaces</Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          display: "block",
          mb: 1.5
        }}>
        Always-on namespaces. Only remove an entry if you know what you&apos;re doing.
      </Typography>
      <ChipInput
        id="protected-chip-input"
        values={values}
        onChange={(v) => onChange([...v].sort())}
        onDelete={(v) => setPendingRemove(v)}
        readOnly={readOnly}
        containerSx={{
          borderColor: AMBER,
          bgcolor: AMBER_06,
          '&:focus-within': { borderColor: AMBER },
        }}
        chipSx={{
          bgcolor: AMBER_12,
          color: 'warning.main',
          '& .MuiChip-deleteIcon': { color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } },
        }}
      />
      <Dialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon sx={{ color: 'warning.main', fontSize: 22 }} />
          Remove system-protected namespace?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            You are about to remove{' '}
            <Box component="span" sx={{ fontFamily: 'monospace', color: 'warning.main', fontWeight: 600 }}>
              {pendingRemove}
            </Box>{' '}
            from the system-protected list. Workloads in this namespace will no longer be excluded from sleep/wake runs.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
            This may affect critical cluster infrastructure. Only proceed if you are certain.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingRemove(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={confirmRemove}>
            Remove anyway
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
