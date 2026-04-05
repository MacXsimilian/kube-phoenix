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
import Tooltip from '@mui/material/Tooltip'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth'
import { canManageUsers, canViewAudit } from '@/lib/rbac'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
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
  { label: 'Observability', href: '/observability', icon: <MonitorHeartOutlinedIcon fontSize="small" /> },
  { label: 'Settings', href: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
]

const EASE = [0.22, 1, 0.36, 1] as const
const DURATION = 0.3
const LABEL_DURATION = DURATION * 0.6

// ── Reusable collapse animation ──────────────────────────────────────────────

function CollapseLabel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: LABEL_DURATION }}
          style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LogoSection({ isCollapsed, onAboutClick }: { isCollapsed: boolean; onAboutClick: () => void }) {
  return (
    <Box
      sx={{
        p: isCollapsed ? 1.5 : 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        transition: `padding ${DURATION}s ease`,
        minHeight: 56,
      }}
    >
      <ButtonBase
        onClick={onAboutClick}
        aria-label="About kube-phoenix"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 2,
          flex: isCollapsed ? undefined : 1,
          '&:hover': { bgcolor: 'action.hover' },
          p: 0.5,
        }}
      >
        <motion.div
          animate={{ scale: isCollapsed ? 1.15 : 1 }}
          transition={{ duration: DURATION, ease: EASE }}
          style={{ fontSize: 34, lineHeight: 1, userSelect: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          🐦‍🔥
        </motion.div>
        <CollapseLabel show={!isCollapsed}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700} letterSpacing={-0.5} sx={{ lineHeight: 1 }}>
              kube-phoenix
            </Typography>
          </Box>
        </CollapseLabel>
      </ButtonBase>
    </Box>
  )
}

function NavItems({
  isCollapsed,
  isMobile,
  visibleNav,
  pathname,
  primary,
  onMobileClose,
}: {
  isCollapsed: boolean
  isMobile: boolean
  visibleNav: NavItem[]
  pathname: string
  primary: string
  onMobileClose: () => void
}) {
  return (
    <List sx={{ pt: 1 }}>
      {visibleNav.map(({ label, href, icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const button = (
          <ListItemButton
            key={href}
            component={Link}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={isCollapsed ? label : undefined}
            onClick={isMobile ? onMobileClose : undefined}
            sx={{
              mx: isCollapsed ? 0.5 : 1,
              mb: 0.5,
              px: isCollapsed ? 0 : 1.5,
              borderRadius: 2,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              color: active ? 'primary.main' : 'text.secondary',
              bgcolor: active ? alpha(primary, 0.10) : 'transparent',
              transition: `padding ${DURATION}s ease, background-color 150ms ease`,
              '&:hover': {
                bgcolor: active ? alpha(primary, 0.16) : 'action.hover',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: isCollapsed ? 0 : 36,
                justifyContent: 'center',
                color: active ? 'primary.main' : 'text.secondary',
                transition: `min-width ${DURATION}s ease`,
              }}
            >
              <motion.div
                animate={{ scale: isCollapsed ? 1.15 : 1 }}
                transition={{ duration: DURATION, ease: EASE }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {icon}
              </motion.div>
            </ListItemIcon>
            <CollapseLabel show={!isCollapsed}>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }}
              />
            </CollapseLabel>
          </ListItemButton>
        )

        return isCollapsed ? (
          <Tooltip key={href} title={label} placement="right" arrow>
            {button}
          </Tooltip>
        ) : (
          <Box key={href}>{button}</Box>
        )
      })}
    </List>
  )
}

function CollapseToggle({ isCollapsed, onToggleCollapse }: { isCollapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <>
      <Divider />
      <Box sx={{ px: 1, py: 0.25 }}>
        <ListItemButton
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          sx={{
            borderRadius: 2,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            px: isCollapsed ? 0 : 1.5,
            py: 0.5,
            minHeight: 0,
            color: 'text.disabled',
            '&:hover': { bgcolor: 'action.hover', color: 'text.secondary' },
          }}
        >
          <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, justifyContent: 'center', color: 'inherit' }}>
            {isCollapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
          </ListItemIcon>
        </ListItemButton>
      </Box>
    </>
  )
}

function SignOutButton({ isCollapsed, onLogout }: { isCollapsed: boolean; onLogout: () => void }) {
  const btn = (
    <ListItemButton
      onClick={onLogout}
      sx={{
        borderRadius: 2,
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        px: isCollapsed ? 0 : 1.5,
        color: 'text.secondary',
        '&:hover': { bgcolor: (t) => alpha(t.palette.error.main, 0.08), color: 'error.main' },
        '&:hover .MuiListItemIcon-root': { color: 'error.main' },
      }}
    >
      <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 36, justifyContent: 'center', color: 'text.secondary' }}>
        <LogoutOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <CollapseLabel show={!isCollapsed}>
        <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: 14 }} />
      </CollapseLabel>
    </ListItemButton>
  )

  return (
    <Box sx={{ p: 1 }}>
      {isCollapsed ? (
        <Tooltip title="Sign Out" placement="right" arrow>{btn}</Tooltip>
      ) : btn}
    </Box>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  expandedWidth: number
  collapsedWidth: number
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  onAboutClick: () => void
}

export default function Sidebar({
  expandedWidth,
  collapsedWidth,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  onAboutClick,
}: Props) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const theme = useTheme()
  const primary = theme.palette.primary.main

  const visibleNav = NAV.filter(item =>
    !item.requirePerm || item.requirePerm(user?.permissions)
  )

  const width = collapsed ? collapsedWidth : expandedWidth

  function renderContent(isMobile: boolean) {
    const isCollapsed = !isMobile && collapsed

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <LogoSection isCollapsed={isCollapsed} onAboutClick={onAboutClick} />
        <Divider />

        <NavItems
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          visibleNav={visibleNav}
          pathname={pathname}
          primary={primary}
          onMobileClose={onMobileClose}
        />

        <Box sx={{ flexGrow: 1 }} />

        {!isMobile && <CollapseToggle isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} />}

        <Divider />
        <SignOutButton isCollapsed={isCollapsed} onLogout={logout} />
      </Box>
    )
  }

  const paperSx = { boxSizing: 'border-box' as const, bgcolor: 'background.paper' }

  return (
    <>
      {/* Mobile: temporary drawer, always full-width expanded */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { ...paperSx, width: expandedWidth } }}
      >
        {renderContent(true)}
      </Drawer>

      {/* Desktop: permanent drawer with animated width */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          width,
          flexShrink: 0,
          transition: `width ${DURATION}s cubic-bezier(${EASE.join(',')})`,
          '& .MuiDrawer-paper': {
            ...paperSx,
            width,
            transition: `width ${DURATION}s cubic-bezier(${EASE.join(',')})`,
            overflowX: 'hidden',
          },
        }}
      >
        {renderContent(false)}
      </Drawer>
    </>
  )
}
