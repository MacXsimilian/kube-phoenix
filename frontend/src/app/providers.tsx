'use client'

import { useMemo } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClientProvider } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import { createAppTheme } from '@/theme/theme'
import { queryClient } from '@/lib/queryClient'
import AppShell from '@/components/layout/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import LoginScreen from '@/components/auth/LoginScreen'
import { ThemeModeProvider, useThemeMode } from '@/lib/themeMode'
import CircularProgress from '@mui/material/CircularProgress'
import ErrorBoundary from '@/components/ErrorBoundary'
import { UnsavedChangesProvider } from '@/lib/useUnsavedChanges'

function AppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checking, backendError } = useAuth()
  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (backendError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert severity="error">Backend unavailable — please check the server and try again.</Alert>
      </Box>
    )
  }
  if (!isAuthenticated) return <LoginScreen />
  return (
    <ErrorBoundary>
      <UnsavedChangesProvider>
        <AppShell>{children}</AppShell>
      </UnsavedChangesProvider>
    </ErrorBoundary>
  )
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { resolvedMode } = useThemeMode()
  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode])
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent>{children}</AppContent>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ThemedApp>{children}</ThemedApp>
      </ThemeModeProvider>
    </QueryClientProvider>
  )
}
