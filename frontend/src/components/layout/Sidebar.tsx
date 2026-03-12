'use client'

import { usePathname, useRouter } from 'next/navigation'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SvgIcon from '@mui/material/SvgIcon'

function PhoenixIcon({ sx }: { sx?: object }) {
  return (
    <SvgIcon sx={sx} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 2c0 0-1.5 2.5-1 4.5C8.5 5.5 7 3 7 3c-.5 3 1 5 1 5C6 8.5 4.5 7 4.5 7 5 10 7.5 11.5 7.5 11.5 6 12 4.5 11.5 4.5 11.5 5.5 14 8 15 8 15c-1 1.5-3 2-3 2 2 1 4.5.5 4.5.5L9 22h6l-.5-4.5c0 0 2.5.5 4.5-.5 0 0-2-.5-3-2 0 0 2.5-1 3.5-3.5 0 0-1.5.5-3 0 0 0 2.5-1.5 3-4.5C19 7 17.5 8.5 17.5 8.5s2-2 1-5c0 0-1.5 2.5-4 3.5.5-2-1-4.5-2.5-5z"
      />
    </SvgIcon>
  )
}

const NAV = [
  { label: 'Overview', href: '/overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Schedules', href: '/schedules', icon: <ScheduleOutlinedIcon fontSize="small" /> },
  { label: 'Cluster State', href: '/cluster', icon: <HubOutlinedIcon fontSize="small" /> },
  { label: 'Guardrails', href: '/guardrails', icon: <SecurityOutlinedIcon fontSize="small" /> },
  { label: 'History', href: '/history', icon: <HistoryOutlinedIcon fontSize="small" /> },
]

export default function Sidebar({ width }: { width: number }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PhoenixIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.5}>
          kube-phoenix
        </Typography>
      </Box>
      <Divider />

      {/* Nav items */}
      <List sx={{ pt: 1 }}>
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <ListItemButton
              key={href}
              onClick={() => router.push(href)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                color: active ? 'primary.main' : 'text.secondary',
                bgcolor: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                '&:hover': {
                  bgcolor: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <ListItemIcon
                sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}
              >
                {icon}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Drawer>
  )
}
