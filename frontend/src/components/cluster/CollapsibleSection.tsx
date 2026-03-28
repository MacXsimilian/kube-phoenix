import React, { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface CollapsibleSectionProps {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({ title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2.5, py: 1, textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12 }}>
          {title}<Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.75 }}>{count}</Typography>
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}
