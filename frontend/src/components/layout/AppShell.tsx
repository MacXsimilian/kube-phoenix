'use client'

import Box from '@mui/material/Box'
import Sidebar from './Sidebar'

const DRAWER_WIDTH = 240

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar width={DRAWER_WIDTH} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${DRAWER_WIDTH}px`,
          p: 3,
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
