'use client'

import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CenteredSpinner from '@/components/common/CenteredSpinner'
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
import { sinceMs, formatError } from '@/lib/formatters'
import { useDrawerResize } from '@/lib/useDrawerResize'
import type { NodePod } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import PodDetailContent from './PodDetailContent'

// ── Spring animation variants ────────────────────────────────────────────────

const STAGGER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

const FADE_UP = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } },
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  parentName: string
  children: React.ReactNode
  pods: NodePod[]
  isLoadingPods: boolean
  isErrorPods: boolean
  errorPods: Error | null
  dataUpdatedAt: number | undefined
  defaultWidth?: number
  podTableHeaders: string[]
  renderPodTableBody: (filteredPods: NodePod[], onSelectPod: (pod: NodePod) => void) => React.ReactNode
  emptyMessage?: string
  closeAriaLabel?: string
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
        <AnimatePresence mode="wait">
          {/* ── Pod detail view ──────────────────────────────────────── */}
          {selectedPod ? (
            <motion.div
              key={`pod-${selectedPod.name}`}
              variants={STAGGER}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <motion.div variants={FADE_UP}>
                <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Tooltip title={`Back to ${parentName}`}>
                        <IconButton size="small" onClick={() => setSelectedPod(null)} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Back">
                          <ArrowBackIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Box sx={{ minWidth: 0 }}>
                        {renderTitle(selectedPod)}
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={handleClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label={closeAriaLabel}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </Box>
              </motion.div>

              <Divider />

              <motion.div variants={FADE_UP} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <PodDetailContent namespace={selectedPod.namespace} podName={selectedPod.name} />
              </motion.div>
            </motion.div>
          ) : (
            /* ── Parent view (workload/node + pod list) ────────────── */
            (<motion.div
              key="parent"
              variants={STAGGER}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              {/* Header + metadata */}
              <motion.div variants={FADE_UP}>
                <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      {renderTitle(null)}
                    </Box>
                    <IconButton size="small" onClick={handleClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label={closeAriaLabel}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                  {children}
                </Box>
              </motion.div>
              <Divider />
              {/* Search toolbar */}
              <motion.div variants={FADE_UP}>
                <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Search pods..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flex: 1 }}
                    slotProps={{ htmlInput: { sx: { fontSize: 13, py: 0.75 } } }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.disabled",
                      whiteSpace: 'nowrap',
                      fontSize: 11
                    }}>
                    {dataUpdatedAt ? sinceMs(dataUpdatedAt) : ''}
                  </Typography>
                </Box>
              </motion.div>
              <Divider />
              {/* Pod list */}
              <motion.div variants={FADE_UP} style={{ flex: 1, overflow: 'auto' }}>
                {isErrorPods ? (
                  <Alert severity="error" sx={{ m: 2 }}>
                    Failed to load pods: {formatError(errorPods)}
                  </Alert>
                ) : isLoadingPods ? (
                  <CenteredSpinner size={28} />
                ) : filtered.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      py: 5,
                      textAlign: 'center'
                    }}>
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
              </motion.div>
            </motion.div>)
          )}
        </AnimatePresence>
      )}
    </Drawer>
  );
}
