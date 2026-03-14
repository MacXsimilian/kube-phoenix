'use client'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClientProvider } from '@tanstack/react-query'
import theme from '@/theme/theme'
import { queryClient } from '@/lib/queryClient'
import AppShell from '@/components/layout/AppShell'
import { AuthProvider, useAuth } from '@/lib/auth'
import LoginScreen from '@/components/auth/LoginScreen'

function AppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checking } = useAuth()
  if (checking) return null
  if (!isAuthenticated) return <LoginScreen />
  return <AppShell>{children}</AppShell>
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
