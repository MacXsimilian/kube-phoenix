'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Tooltip from '@mui/material/Tooltip'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { notificationsApi, adminApi } from '@/lib/api'
import NotificationDrawer from '@/components/notifications/NotificationDrawer'

const NAV = [
  { label: 'Overview', href: '/overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Policies', href: '/policies', icon: <CalendarTodayOutlinedIcon fontSize="small" /> },
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
  const [notifOpen, setNotifOpen] = useState(false)

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })

  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: adminApi.getVersion,
    staleTime: Infinity,
  })

  const unreadCount = notifData?.unreadCount ?? 0
  const appVersion = versionData?.version ?? 'dev'

  const content = (
    <>
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 22, lineHeight: 1, userSelect: 'none' }}>🐦‍🔥</Typography>
        <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.5}>
          kube-phoenix
        </Typography>
      </Box>
      <Divider />

      {/* Nav items */}
      <List sx={{ pt: 1, flex: 1 }}>
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

      {/* Bell notification button */}
      <Divider />
      <Box sx={{ px: 1.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Notifications" placement="right">
          <IconButton
            onClick={() => setNotifOpen(true)}
            size="small"
            aria-label="Open notifications"
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            <Badge
              badgeContent={unreadCount > 9 ? '9+' : unreadCount}
              color="error"
              invisible={unreadCount === 0}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: 10,
                  height: 16,
                  minWidth: 16,
                },
              }}
            >
              <NotificationsNoneOutlinedIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          Notifications
        </Typography>
      </Box>

      {/* Version */}
      <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
          v{appVersion}
        </Typography>
      </Box>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )

  const paperSx = {
    width,
    boxSizing: 'border-box' as const,
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column' as const,
  }

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
