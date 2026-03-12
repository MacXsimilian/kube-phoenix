'use client'

import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7C3AED',
      light: '#9D5FF5',
      dark: '#5B21B6',
    },
    background: {
      default: '#0F0F13',
      paper: '#1A1A24',
    },
    success: { main: '#22C55E' },
    warning: { main: '#F59E0B' },
    error: { main: '#EF4444' },
    info: { main: '#3B82F6' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,255,255,0.07)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.07)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backgroundColor: '#0F0F13',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.05)',
        },
      },
    },
  },
})

export default theme
