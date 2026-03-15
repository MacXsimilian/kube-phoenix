'use client'

import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

const VERSION = '0.1.0'
const REPO_URL = 'https://github.com/MacXsimilian/kube-phoenix'

export default function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', borderRadius: 3 } } }}
    >
      <DialogContent sx={{ p: 3 }}>
        {/* Close */}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Close about dialog"
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.disabled' }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {/* Logo + title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography sx={{ fontSize: 32, lineHeight: 1, userSelect: 'none' }}>🐦‍🔥</Typography>
          <Box>
            <Typography variant="h6" fontWeight={700} letterSpacing={-0.5} lineHeight={1.2}>
              kube-phoenix
            </Typography>
            <Chip
              label={`v${VERSION}`}
              size="small"
              sx={{
                mt: 0.5,
                height: 18,
                fontSize: 11,
                bgcolor: 'rgba(124,58,237,0.15)',
                color: 'primary.light',
                fontFamily: 'monospace',
              }}
            />
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Description */}
        <Typography variant="body2" color="text.secondary" lineHeight={1.65}>
          Schedule-driven Kubernetes cluster sleep/wake manager. Replaces manual cronjob scaling
          with a web-based scheduler, live cluster visibility, and a full execution audit trail.
        </Typography>

        {/* GitHub link */}
        <Box sx={{ mt: 2.5 }}>
          <Button
            component="a"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'text.secondary',
              fontSize: 12,
              textTransform: 'none',
              '&:hover': { borderColor: 'primary.main', color: 'primary.light' },
            }}
          >
            MacXsimilian/kube-phoenix
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
