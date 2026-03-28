'use client'

import { alpha, useTheme } from '@mui/material/styles'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import { useAuth } from '@/lib/auth'
import { canManageUsers, canViewAudit } from '@/lib/rbac'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  /** If set, only show when user has this permission */
  requirePerm?: (perms?: string[]) => boolean
}

const NAV: NavItem[] = [
  { label: 'Overview', href: '/overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Cluster State', href: '/cluster', icon: <HubOutlinedIcon fontSize="small" /> },
  { label: 'Guardrails', href: '/guardrails', icon: <SecurityOutlinedIcon fontSize="small" /> },
  { label: 'Policies', href: '/policies', icon: <EventRepeatOutlinedIcon fontSize="small" /> },
  { label: 'Exceptions', href: '/exceptions', icon: <FlagOutlinedIcon fontSize="small" /> },
  { label: 'History', href: '/history', icon: <HistoryOutlinedIcon fontSize="small" /> },
  { label: 'Users', href: '/users', icon: <PeopleOutlinedIcon fontSize="small" />, requirePerm: canManageUsers },
  { label: 'Audit Log', href: '/audit', icon: <AssignmentOutlinedIcon fontSize="small" />, requirePerm: canViewAudit },
  { label: 'Settings', href: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
]

interface Props {
  width: number
  mobileOpen: boolean
  onMobileClose: () => void
  onAboutClick: () => void
}

export default function Sidebar({ width, mobileOpen, onMobileClose, onAboutClick }: Props) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const theme = useTheme()
  const primary = theme.palette.primary.main

  const visibleNav = NAV.filter(item =>
    !item.requirePerm || item.requirePerm(user?.permissions)
  )

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo — click to open About */}
      <ButtonBase
        onClick={onAboutClick}
        aria-label="About kube-phoenix"
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 2,
          mx: 0.5,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography role="img" aria-label="kube-phoenix logo" sx={{ fontSize: 22, lineHeight: 1, userSelect: 'none' }}>🐦‍🔥</Typography>
        <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.5}>
          kube-phoenix
        </Typography>
      </ButtonBase>
      <Divider />

      {/* Nav items */}
      <List sx={{ pt: 1 }}>
        {visibleNav.map(({ label, href, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <ListItemButton
              key={href}
              component={Link}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={onMobileClose}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                color: active ? 'primary.main' : 'text.secondary',
                bgcolor: active ? alpha(primary, 0.10) : 'transparent',
                '&:hover': {
                  bgcolor: active ? alpha(primary, 0.16) : 'action.hover',
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
