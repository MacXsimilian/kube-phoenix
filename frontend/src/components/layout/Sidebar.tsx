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
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import { useAuth } from '@/lib/auth'

const NAV = [
  { label: 'Overview', href: '/overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Schedules', href: '/schedules', icon: <ScheduleOutlinedIcon fontSize="small" /> },
  { label: 'Cluster State', href: '/cluster', icon: <HubOutlinedIcon fontSize="small" /> },
  { label: 'Guardrails', href: '/guardrails', icon: <SecurityOutlinedIcon fontSize="small" /> },
  { label: 'History', href: '/history', icon: <HistoryOutlinedIcon fontSize="small" /> },
  { label: 'Settings', href: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
]

interface Props {
  width: number
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ width, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 22, lineHeight: 1, userSelect: 'none' }}>🐦‍🔥</Typography>
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
              aria-current={active ? 'page' : undefined}
              onClick={() => { router.push(href); onMobileClose() }}
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
              <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
                {icon}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
              />
            </ListItemButton>
          )
        })}
      </List>

      {/* Logout — pushed to bottom */}
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <Box sx={{ p: 1 }}>
        <ListItemButton
          onClick={logout}
          sx={{
            borderRadius: 2,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(239,68,68,0.08)', color: 'error.main' },
            '&:hover .MuiListItemIcon-root': { color: 'error.main' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign Out"
            primaryTypographyProps={{ fontSize: 14 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  )

  const paperSx = { width, boxSizing: 'border-box' as const, bgcolor: 'background.paper' }

  return (
    <>
      {/* Mobile: temporary drawer, slides in over content */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx }}
      >
        {content}
      </Drawer>

      {/* Desktop: permanent drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{ display: { xs: 'none', md: 'block' }, width, flexShrink: 0, '& .MuiDrawer-paper': paperSx }}
      >
        {content}
      </Drawer>
    </>
  )
}
