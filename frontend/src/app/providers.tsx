'use client'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClientProvider } from '@tanstack/react-query'
import theme from '@/theme/theme'
import { queryClient } from '@/lib/queryClient'
import AppShell from '@/components/layout/AppShell'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppShell>{children}</AppShell>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
