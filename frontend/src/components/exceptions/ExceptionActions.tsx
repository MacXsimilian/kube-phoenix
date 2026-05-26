'use client'

import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CloseIcon from '@mui/icons-material/Close'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import type { ScheduledException } from '@/lib/types'

interface ExceptionActionsProps {
  ex: ScheduledException
  canEdit: boolean
  onEdit: () => void
  onCancel: () => void
  onExport?: (anchor: HTMLElement) => void
}

export default function ExceptionActions({ ex, canEdit, onEdit, onCancel, onExport }: ExceptionActionsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {canEdit && ex.status === 'pending' && (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit() }} aria-label="Edit"><EditOutlinedIcon fontSize="small" /></IconButton>
      )}
      {onExport && (
        <Tooltip title="Export">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onExport(e.currentTarget) }} aria-label="Export"><FileUploadOutlinedIcon fontSize="small" /></IconButton>
        </Tooltip>
      )}
      {canEdit && (ex.status === 'pending' || ex.status === 'active') && (
        <Tooltip title="Cancel exception">
          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onCancel() }} aria-label="Cancel"><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
