'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useThemeMode } from '@/lib/themeMode'
import { useAuth } from '@/lib/auth'
import { canResetDB } from '@/lib/rbac'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import AccountSettings from '@/components/settings/AccountSettings'
import DatabaseSettings from '@/components/settings/DatabaseSettings'
import OIDCStatusCard from '@/components/settings/OIDCStatusCard'

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode()
  const { user } = useAuth()

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Application configuration and administrative operations.
      </Typography>

      <AppearanceSettings mode={mode} onModeChange={setMode} />

      {user && user.id !== 0 && <AccountSettings user={user} />}

      <OIDCStatusCard />

      {canResetDB(user?.permissions) && <DatabaseSettings />}
    </Box>
  )
}
