'use client'

import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import SvgIcon from '@mui/material/SvgIcon'
import Sidebar from './Sidebar'

function PhoenixIcon({ sx }: { sx?: object }) {
  return (
    <SvgIcon sx={sx} viewBox="0 0 24 24">
      {/* flame base */}
      <path
        fill="currentColor"
        d="M12 2c0 0-1.5 2.5-1 4.5C8.5 5.5 7 3 7 3c-.5 3 1 5 1 5C6 8.5 4.5 7 4.5 7 5 10 7.5 11.5 7.5 11.5 6 12 4.5 11.5 4.5 11.5 5.5 14 8 15 8 15c-1 1.5-3 2-3 2 2 1 4.5.5 4.5.5L9 22h6l-.5-4.5c0 0 2.5.5 4.5-.5 0 0-2-.5-3-2 0 0 2.5-1 3.5-3.5 0 0-1.5.5-3 0 0 0 2.5-1.5 3-4.5C19 7 17.5 8.5 17.5 8.5s2-2 1-5c0 0-1.5 2.5-4 3.5.5-2-1-4.5-2.5-5z"
      />
    </SvgIcon>
  )
}

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
          <PhoenixIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 20 }} />
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
