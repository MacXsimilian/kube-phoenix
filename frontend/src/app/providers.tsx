'use client'

import { useMemo } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClientProvider } from '@tanstack/react-query'
import { createAppTheme } from '@/theme/theme'
import { queryClient } from '@/lib/queryClient'
import AppShell from '@/components/layout/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import LoginScreen from '@/components/auth/LoginScreen'
import { ThemeModeProvider, useThemeMode } from '@/lib/themeMode'

function AppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checking } = useAuth()
  if (checking) return null
  if (!isAuthenticated) return <LoginScreen />
  return <AppShell>{children}</AppShell>
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
