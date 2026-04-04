'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const EXPANDED_WIDTH = 240
const COLLAPSED_WIDTH = 64

const NAV_ITEMS = [
  { label: 'Overview', icon: <DashboardOutlinedIcon fontSize="small" />, active: true },
  { label: 'Cluster State', icon: <HubOutlinedIcon fontSize="small" />, active: false },
  { label: 'Guardrails', icon: <SecurityOutlinedIcon fontSize="small" />, active: false },
  { label: 'Policies', icon: <EventRepeatOutlinedIcon fontSize="small" />, active: false },
  { label: 'Exceptions', icon: <FlagOutlinedIcon fontSize="small" />, active: false },
  { label: 'History', icon: <HistoryOutlinedIcon fontSize="small" />, active: false },
  { label: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" />, active: false },
]

export default function SidebarMorphPrototype() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitionMs, setTransitionMs] = useState(300)

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>D5 — Sidebar Morph</Typography>
          <Typography variant="body2" color="text.secondary">
            Collapsible sidebar with smooth label fade and icon scale
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Duration: {transitionMs}ms
          </Typography>
          <Slider
            value={transitionMs}
            onChange={(_, v) => setTransitionMs(v as number)}
            min={100}
            max={600}
            step={50}
            size="small"
            sx={{ width: 120 }}
          />
        </Box>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          display: 'flex',
          height: 560,
        }}
      >
        {/* Sidebar */}
        <motion.div
          animate={{ width: sidebarWidth }}
          transition={{ duration: transitionMs / 1000, ease: [0.22, 1, 0.36, 1] }}
          style={{
            flexShrink: 0,
            backgroundColor: 'var(--mui-palette-background-paper, #1A1A24)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Logo */}
          <Box
            sx={{
              p: collapsed ? 1.5 : 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: `padding ${transitionMs}ms ease`,
              justifyContent: collapsed ? 'center' : 'flex-start',
              minHeight: 56,
            }}
          >
            <motion.div
              animate={{ scale: collapsed ? 1.2 : 1 }}
              transition={{ duration: transitionMs / 1000, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: 22, lineHeight: 1, userSelect: 'none', flexShrink: 0 }}
            >
              🐦‍🔥
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: transitionMs / 1000 * 0.6 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  <Typography variant="subtitle1" fontWeight={700} letterSpacing={-0.5}>
                    kube-phoenix
                  </Typography>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
          <Divider />

          {/* Nav items */}
          <Box sx={{ pt: 1, flex: 1 }}>
            {NAV_ITEMS.map((item, i) => {
              const active = i === activeIndex
              return (
                <Box
                  key={item.label}
                  onClick={() => setActiveIndex(i)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mx: collapsed ? 0.5 : 1,
                    mb: 0.5,
                    px: collapsed ? 0 : 1.5,
                    py: 1,
                    borderRadius: 2,
                    cursor: 'pointer',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? 'rgba(124,58,237,0.10)' : 'transparent',
                    transition: `padding ${transitionMs}ms ease, background-color 150ms ease, justify-content ${transitionMs}ms ease`,
                    '&:hover': {
                      bgcolor: active ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.04)',
                    },
                    position: 'relative',
                  }}
                >
                  <motion.div
                    animate={{ scale: collapsed ? 1.15 : 1 }}
                    transition={{ duration: transitionMs / 1000, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      color: 'inherit',
                    }}
                  >
                    {item.icon}
                  </motion.div>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: transitionMs / 1000 * 0.6 }}
                        style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: 14,
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {item.label}
                        </Typography>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '100%',
                        ml: 1,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        whiteSpace: 'nowrap',
                        opacity: 0,
                        pointerEvents: 'none',
                        transform: 'translateX(-4px)',
                        transition: 'opacity 150ms ease, transform 150ms ease',
                        zIndex: 10,
                        '.MuiBox-root:hover > &': {
                          opacity: 1,
                          transform: 'translateX(0)',
                        },
                      }}
                    >
                      <Typography variant="caption">{item.label}</Typography>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </motion.div>

        {/* Main content */}
        <motion.div
          layout
          transition={{ duration: transitionMs / 1000, ease: [0.22, 1, 0.36, 1] }}
          style={{
            flex: 1,
            padding: 24,
            overflow: 'auto',
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            {NAV_ITEMS[activeIndex].label}
          </Typography>

          {/* Placeholder content cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: collapsed ? '1fr 1fr 1fr' : '1fr 1fr', gap: 2, transition: `grid-template-columns ${transitionMs}ms ease` }}>
            {[1, 2, 3, 4].map((n) => (
              <motion.div
                key={n}
                layout
                transition={{ duration: transitionMs / 1000, ease: [0.22, 1, 0.36, 1] }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Card {n}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Notice how the content area smoothly reflows as the sidebar collapses.
            The grid adjusts from 2 to 3 columns to use the freed space.
          </Typography>
        </motion.div>
      </Box>
    </Box>
  )
}
