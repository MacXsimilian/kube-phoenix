'use client'

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useDrawerResize } from '@/lib/useDrawerResize'
import PodDetailContent from './PodDetailContent'
import type { NodePod } from '@/lib/types'

export default function PodDetailDrawer({ pod, onClose }: { pod: NodePod | null; onClose: () => void }) {
  const [drawerWidth, handleResizeMouseDown, handleResizeTouchStart] = useDrawerResize(520)

  return (
    <Drawer
      anchor="right"
      open={pod != null}
      onClose={onClose}
      slotProps={{ paper: {
        sx: {
          width: { xs: '100vw', md: drawerWidth },
          bgcolor: '#1A1A24',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
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
          left: -4, top: 0, bottom: 0, width: 8,
          cursor: 'col-resize', zIndex: 1,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.4 },
          display: { xs: 'none', md: 'block' },
        }}
      />

      {pod && (
        <>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
                {pod.namespace}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}>
                {pod.name}
              </Typography>
            </Box>
            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose} sx={{ mt: -0.25, flexShrink: 0 }} aria-label="Close pod detail">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <PodDetailContent namespace={pod.namespace} podName={pod.name} />
          </Box>
        </>
      )}
    </Drawer>
  )
}
