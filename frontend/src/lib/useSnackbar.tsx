'use client'

import { useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { SNACKBAR_AUTO_HIDE_MS } from '@/lib/constants'

interface SnackState {
  message: string
  severity: 'success' | 'error'
}

export function useSnackbar() {
  const [snack, setSnack] = useState<SnackState | null>(null)

  function notify(message: string, severity: 'success' | 'error') {
    setSnack({ message, severity })
  }

  const SnackbarAlert = (
    <Snackbar
      open={!!snack}
      autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
      onClose={() => setSnack(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {snack ? (
        <Alert severity={snack.severity} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  )

  return { notify, SnackbarAlert } as const
}
