'use client'

import { createTheme } from '@mui/material/styles'

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark'
  const divider = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#7C3AED' : '#6D28D9',
        light: isDark ? '#9D5FF5' : '#7C3AED',
        dark: '#5B21B6',
      },
      background: {
        default: isDark ? '#0F0F13' : '#F5F5F7',
        paper: isDark ? '#1A1A24' : '#FFFFFF',
      },
      success: { main: isDark ? '#22C55E' : '#15803D' },
      warning: { main: isDark ? '#F59E0B' : '#92400E' },
      error: { main: isDark ? '#EF4444' : '#B91C1C' },
      info: { main: isDark ? '#3B82F6' : '#1D4ED8' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${divider}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${divider}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            border: 'none',
            borderRight: `1px solid ${divider}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderBottom: `1px solid ${divider}`,
            backgroundColor: isDark ? '#0F0F13' : '#FFFFFF',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
          notchedOutline: {
            '& legend': { fontSize: '0.78em' },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: divider,
          },
        },
      },
    },
  })
}

export default createAppTheme('dark')
