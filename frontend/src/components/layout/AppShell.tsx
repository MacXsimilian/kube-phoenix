'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from './Sidebar'
import AboutModal from './AboutModal'

export const DRAWER_WIDTH = 240

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile top bar — hidden on md+ */}
      <AppBar
        position="fixed"
        sx={{
          display: { md: 'none' },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          zIndex: (t) => t.zIndex.appBar,
        }}
      >
        <Toolbar sx={{ minHeight: 52 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }} aria-label="Open navigation menu">
            <MenuIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            letterSpacing={-0.5}
            onClick={() => setAboutOpen(true)}
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.light' } }}
          >
            kube-phoenix
          </Typography>
        </Toolbar>
      </AppBar>

      <Sidebar
        width={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onAboutClick={() => setAboutOpen(true)}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          mt: { xs: '52px', md: 0 },
          p: { xs: 2, sm: 2.5, md: 3 },
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
