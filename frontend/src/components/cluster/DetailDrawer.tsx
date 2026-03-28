'use client'

import React, { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { sinceMs } from '@/lib/formatters'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { NodePod } from '@/lib/types'
import PodDetailContent from './PodDetailContent'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  /** Title shown when no pod is selected (parent entity name). */
  parentName: string
  /** Content rendered between the header and the pod toolbar (metadata, labels, bars, etc.). Hidden when a pod is selected. */
  children: React.ReactNode
  pods: NodePod[]
  isLoadingPods: boolean
  isErrorPods: boolean
  errorPods: Error | null
  dataUpdatedAt: number | undefined
  onRefreshPods: () => void
  /** Initial drawer width. */
  defaultWidth?: number
  /** Column headers for the pod table. */
  podTableHeaders: string[]
  /** Render the table body content from the filtered pod list. Receives filtered pods and a callback to select a pod. */
  renderPodTableBody: (filteredPods: NodePod[], onSelectPod: (pod: NodePod) => void) => React.ReactNode
  /** Empty-state message shown when no pods exist (before any search filter). */
  emptyMessage?: string
  /** Close button aria-label. */
  closeAriaLabel?: string
  /** Title area rendered in the header. Receives the selected pod (if any) for conditional rendering. */
  renderTitle: (selectedPod: NodePod | null) => React.ReactNode
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DetailDrawer({
  open,
  onClose,
  parentName,
  children,
  pods,
  isLoadingPods,
  isErrorPods,
  errorPods,
  dataUpdatedAt,
  onRefreshPods,
  defaultWidth = 540,
  podTableHeaders,
  renderPodTableBody,
  emptyMessage = 'No pods found.',
  closeAriaLabel = 'Close detail',
  renderTitle,
}: DetailDrawerProps) {
  const [search, setSearch] = useState('')
  const [selectedPod, setSelectedPod] = useState<NodePod | null>(null)
  const { width: drawerWidth, onMouseDown: handleResizeMouseDown, onTouchStart: handleResizeTouchStart } = useDrawerResize(defaultWidth)

  function handleClose() {
    setSelectedPod(null)
    onClose()
  }

  const filtered = useMemo(
    () => !search ? pods : pods.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.ownerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.namespace.toLowerCase().includes(search.toLowerCase())
    ),
    [pods, search],
  )

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      slotProps={{ paper: {
        sx: {
          width: { xs: '100vw', md: drawerWidth },
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
        },
      } }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleResizeMouseDown}
        onTouchStart={handleResizeTouchStart}
        sx={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 1,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.4 },
          display: { xs: 'none', md: 'block' },
        }}
      />

      {open && (
        <>
          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {selectedPod && (
                  <Tooltip title={`Back to ${parentName}`}>
                    <IconButton size="small" onClick={() => setSelectedPod(null)} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Back">
                      <ArrowBackIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Box sx={{ minWidth: 0 }}>
                  {renderTitle(selectedPod)}
                </Box>
              </Box>
              <IconButton size="small" onClick={handleClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label={closeAriaLabel}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Caller-specific metadata -- hidden when viewing a pod */}
            {!selectedPod && children}
          </Box>

          <Divider />

          {/* Pod detail content -- replaces toolbar + pod list */}
          {selectedPod && (
            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <PodDetailContent namespace={selectedPod.namespace} podName={selectedPod.name} />
            </Box>
          )}

          {/* Toolbar -- hidden in pod detail view */}
          {!selectedPod && (
            <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Search pods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1 }}
                slotProps={{ htmlInput: { sx: { fontSize: 13, py: 0.75 } } }}
              />
              <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                {dataUpdatedAt ? sinceMs(dataUpdatedAt) : ''}
              </Typography>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={onRefreshPods} aria-label="Refresh pod list">
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {!selectedPod && <Divider />}

          {/* Pod list -- hidden in pod detail view */}
          {!selectedPod && (
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {isErrorPods ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  Failed to load pods: {errorPods instanceof Error ? errorPods.message : 'Unknown error'}
                </Alert>
              ) : isLoadingPods ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : filtered.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
                  {search ? 'No pods match your search.' : emptyMessage}
                </Typography>
              ) : (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {podTableHeaders.map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: 'text.disabled', fontSize: 11, bgcolor: 'background.default', py: 0.75 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {renderPodTableBody(filtered, setSelectedPod)}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}
        </>
      )}
    </Drawer>
  )
}
