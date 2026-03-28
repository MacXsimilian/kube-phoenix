'use client'

import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import { useThemeMode } from '@/lib/themeMode'
import { useAuth } from '@/lib/auth'
import { canResetDB } from '@/lib/rbac'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import AccountSettings from '@/components/settings/AccountSettings'
import ActiveSessionsCard from '@/components/settings/ActiveSessionsCard'
import ClusterConnectionCard from '@/components/settings/ClusterConnectionCard'
import OIDCStatusCard from '@/components/settings/OIDCStatusCard'
import DatabaseSettings from '@/components/settings/DatabaseSettings'
import AboutBar from '@/components/settings/AboutBar'

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode()
  const { user } = useAuth()

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Manage your account, appearance, and system configuration.
      </Typography>

      <Grid container spacing={3}>
        {/* Top row: Profile (left) + Appearance & Sessions (right) */}
        {user && user.id !== 0 && (
          <Grid size={{ xs: 12, md: 7 }}>
            <AccountSettings user={user} />
          </Grid>
        )}

        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <AppearanceSettings mode={mode} onModeChange={setMode} />
            <ActiveSessionsCard />
          </Box>
        </Grid>

        {/* Full-width rows */}
        <Grid size={12}>
          <ClusterConnectionCard />
        </Grid>

        <Grid size={12}>
          <OIDCStatusCard />
        </Grid>

        {canResetDB(user?.permissions) && (
          <Grid size={12}>
            <DatabaseSettings />
          </Grid>
        )}

        <Grid size={12}>
          <AboutBar />
        </Grid>
      </Grid>
    </>
  )
}
