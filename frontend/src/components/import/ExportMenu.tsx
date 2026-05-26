'use client'

import { useState } from 'react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { copyJsonToClipboard, downloadJsonFile } from '@/lib/exportFile'
import { formatError } from '@/lib/formatters'

interface ExportMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  fetchPayload: () => Promise<unknown>
  downloadName: string
  onNotify?: (msg: string, severity: 'success' | 'error') => void
}

/**
 * Shared menu that fetches an export payload, then offers "Copy JSON" or
 * "Download .json". Wraps the API call so callers don't reimplement error
 * handling. Closes after either action.
 */
export default function ExportMenu({ anchorEl, open, onClose, fetchPayload, downloadName, onNotify }: ExportMenuProps) {
  const [busy, setBusy] = useState(false)

  const runCopy = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = await fetchPayload()
      await copyJsonToClipboard(payload)
      onNotify?.('Copied JSON to clipboard', 'success')
    } catch (err) {
      onNotify?.(formatError(err), 'error')
    } finally {
      setBusy(false)
      onClose()
    }
  }

  const runDownload = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = await fetchPayload()
      downloadJsonFile(payload, downloadName)
      onNotify?.('Download started', 'success')
    } catch (err) {
      onNotify?.(formatError(err), 'error')
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      <MenuItem disabled={busy} onClick={runCopy}>Copy JSON to clipboard</MenuItem>
      <MenuItem disabled={busy} onClick={runDownload}>Download .json</MenuItem>
    </Menu>
  )
}
