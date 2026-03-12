'use client'

import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import Sidebar from './Sidebar'

const DRAWER_WIDTH = 240

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, width: `calc(100% - ${DRAWER_WIDTH}px)`, ml: `${DRAWER_WIDTH}px` }}
      >
        <Toolbar sx={{ minHeight: 56 }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 20 }} />
          <Typography variant="h6" fontWeight={700} letterSpacing={-0.5}>
            kube-phoenix
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar width={DRAWER_WIDTH} />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${DRAWER_WIDTH}px`,
          mt: '56px',
          p: 3,
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
