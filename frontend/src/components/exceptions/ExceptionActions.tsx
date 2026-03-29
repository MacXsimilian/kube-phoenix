'use client'

import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CloseIcon from '@mui/icons-material/Close'
import type { ScheduledException } from '@/lib/types'

export default function ExceptionActions({ ex, canEdit, onEdit, onCancel }: { ex: ScheduledException; canEdit: boolean; onEdit: () => void; onCancel: () => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {canEdit && ex.status === 'pending' && (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit() }} aria-label="Edit"><EditOutlinedIcon fontSize="small" /></IconButton>
      )}
      {canEdit && (ex.status === 'pending' || ex.status === 'active') && (
        <Tooltip title="Cancel exception">
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onCancel() }} aria-label="Cancel"><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
