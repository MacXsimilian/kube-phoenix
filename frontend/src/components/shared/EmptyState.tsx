'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      {icon && (
        <Box sx={{ color: 'text.disabled', fontSize: 40, display: 'flex' }}>
          {icon}
        </Box>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}
