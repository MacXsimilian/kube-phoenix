'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useIsDark } from '@/lib/useIsDark'

interface SettingsSectionProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  pills?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  tinted?: 'red'
}

export default function SettingsSection({
  icon,
  title,
  subtitle,
  pills,
  expanded,
  onToggle,
  children,
  tinted,
}: SettingsSectionProps) {
  const isDark = useIsDark()
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor:
          tinted === 'red' ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)') : undefined,
        borderColor:
          tinted === 'red' ? (isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)') : undefined,
      }}
    >
      <Box onClick={onToggle} sx={{ cursor: 'pointer' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
              }}
            >
              {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {title}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {subtitle}
              </Typography>
            </Box>
            {!expanded && pills && (
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  gap: 0.5,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {pills}
              </Box>
            )}
            <ExpandMoreIcon
              fontSize="small"
              sx={{
                color: 'text.secondary',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }}
            />
          </Box>
        </CardContent>
      </Box>
      <Collapse in={expanded}>
        <Divider />
        <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>{children}</CardContent>
      </Collapse>
    </Card>
  )
}
