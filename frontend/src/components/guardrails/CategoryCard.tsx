'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { SxProps, Theme } from '@mui/material/styles'

export interface CategoryCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  pills?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  cardSx?: SxProps<Theme>
  dividerSx?: SxProps<Theme>
}

export default function CategoryCard({
  icon,
  title,
  subtitle,
  pills,
  expanded,
  onToggle,
  children,
  cardSx,
  dividerSx,
}: CategoryCardProps) {
  return (
    <Card variant="outlined" sx={cardSx}>
      <Box onClick={onToggle} sx={{ cursor: 'pointer' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
              {icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" fontWeight={700} fontSize={14}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            </Box>
            {!expanded && pills}
            <ExpandMoreIcon
              fontSize="small"
              sx={{ color: 'text.secondary', transform: expanded ? 'rotate(180deg)' : 'none', transition: '.2s' }}
            />
          </Box>
        </CardContent>
      </Box>
      <Collapse in={expanded}>
        <Divider sx={dividerSx} />
        <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
          {children}
        </CardContent>
      </Collapse>
    </Card>
  )
}
