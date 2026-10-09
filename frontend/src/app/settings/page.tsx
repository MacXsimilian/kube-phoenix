'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import PersonIcon from '@mui/icons-material/Person'
import SecurityIcon from '@mui/icons-material/Security'
import PaletteIcon from '@mui/icons-material/Palette'
import StorageIcon from '@mui/icons-material/Storage'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness'
import { useColors } from '@/lib/colors'
import { useIsDark } from '@/lib/useIsDark'
import { subtleBorder } from '@/lib/statusColors'
import { useThemeMode, type ThemeMode } from '@/lib/themeMode'
import { useAuth } from '@/lib/auth'
import { useSnackbar } from '@/lib/useSnackbar'
import { canResetDB, canEmergencyScale } from '@/lib/rbac'
import { TIMEZONES } from '@/lib/constants'
import {
  getClusterInfo,
  getVersionInfo,
  getSessions,
  getOIDCConfig,
  getGuardrails,
  updateUserSettings,
} from '@/lib/api'
import DatabaseSettings from '@/components/settings/DatabaseSettings'
import PageHeader from '@/components/shared/PageHeader'
import SettingsSection from '@/components/settings/SettingsSection'
import { StatPill, LedDot, FieldRow, PulseStat } from '@/components/settings/SettingsFields'
import SessionsTable from '@/components/settings/SessionsTable'
import VersionDetails from '@/components/settings/VersionDetails'

type SettingsSectionKey =
  'profile' | 'cluster' | 'appearance' | 'security' | 'pulse' | 'danger' | 'about'

export default function SettingsPage() {
  const isDark = useIsDark()
  const colors = useColors()
  const { mode, setMode } = useThemeMode()
  const { user, refreshUser } = useAuth()
  const { notify, SnackbarAlert } = useSnackbar()

  const [expanded, setExpanded] = useState<Record<SettingsSectionKey, boolean>>({
    profile: true,
    cluster: false,
    appearance: false,
    security: false,
    pulse: false,
    danger: false,
    about: false,
  })

  const toggleSection = (key: SettingsSectionKey) =>
    setExpanded((previous) => ({ ...previous, [key]: !previous[key] }))

  /* ── Data fetching ────────────────────────────────────────────────── */
  const { data: clusterInfo, isLoading: clusterLoading } = useQuery({
    queryKey: queryKeys.clusterInfo(),
    queryFn: getClusterInfo,
    staleTime: 5 * 60_000,
  })

  const { data: versionInfo, isLoading: versionLoading } = useQuery({
    queryKey: queryKeys.version(),
    queryFn: getVersionInfo,
    staleTime: 5 * 60_000,
  })

  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useQuery({
    queryKey: queryKeys.sessions(),
    queryFn: getSessions,
  })

  const { data: oidcConfig } = useQuery({
    queryKey: queryKeys.oidcConfig(),
    queryFn: getOIDCConfig,
  })

  const { data: guardrails } = useQuery({
    queryKey: queryKeys.guardrails(),
    queryFn: getGuardrails,
  })

  /* ── Timezone mutation ────────────────────────────────────────────── */
  const timezoneMutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      refreshUser()
      notify('Timezone updated', 'success')
    },
    onError: (err: Error) => notify(err.message || 'Failed to update timezone', 'error'),
  })

  const handleTimezoneChange = (tz: string) => timezoneMutation.mutate({ defaultTimezone: tz })

  /* ── Derived values ───────────────────────────────────────────────── */
  const showDanger = canResetDB(user?.permissions) || canEmergencyScale(user?.permissions)
  const oidcEnabled = oidcConfig?.enabled ?? false
  const oidcMounted = oidcConfig?.mounted ?? false
  const sessionCount = sessions?.length ?? 0

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, appearance, and system configuration."
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* ── Profile & Identity ────────────────────────────────────── */}
        {user && user.id !== 0 && (
          <SettingsSection
            icon={<PersonIcon fontSize="small" />}
            title="Profile & Identity"
            subtitle="Account info, timezone, and authentication source"
            pills={
              <>
                <StatPill label={user.username} />
                <StatPill label={user.role} color={colors.info} />
                {oidcEnabled && <StatPill label="OIDC" color={colors.success} />}
              </>
            }
            expanded={expanded.profile}
            onToggle={() => toggleSection('profile')}
          >
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}
            >
              <FieldRow label="Username" value={user.username} />
              <FieldRow label="Role" value={user.role} />
              <FieldRow
                label="Auth Source"
                value={user.source === 'oidc' ? 'SSO (OIDC)' : 'Local'}
              />
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    mb: 0.5,
                    display: 'block',
                  }}
                >
                  Timezone
                </Typography>
                <Select
                  size="small"
                  value={user.defaultTimezone ?? 'UTC'}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  disabled={timezoneMutation.isPending}
                  fullWidth
                  sx={{ fontSize: 13 }}
                  MenuProps={{ slotProps: { paper: { sx: { maxHeight: 300 } } } }}
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz} sx={{ fontSize: 13 }}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            {/* OIDC Details */}
            {oidcMounted && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${subtleBorder(isDark)}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    OIDC Connection
                  </Typography>
                  <LedDot state={oidcEnabled ? 'awake' : 'unknown'} />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 1.5,
                  }}
                >
                  {oidcConfig?.issuerURL && (
                    <FieldRow label="Issuer" value={oidcConfig.issuerURL} mono />
                  )}
                  {oidcConfig?.clientID && (
                    <FieldRow label="Client ID" value={oidcConfig.clientID} mono />
                  )}
                  {oidcConfig?.redirectURL && (
                    <FieldRow label="Redirect URL" value={oidcConfig.redirectURL} mono />
                  )}
                  <FieldRow label="Status" value={oidcEnabled ? 'Connected' : 'Not initialized'} />
                </Box>
              </Box>
            )}
          </SettingsSection>
        )}

        {/* ── Cluster & Connection ──────────────────────────────────── */}
        <SettingsSection
          icon={<StorageIcon fontSize="small" />}
          title="Cluster & Connection"
          subtitle="Kubernetes cluster details and API server status"
          pills={
            clusterInfo ? (
              <>
                <StatPill label={clusterInfo.clusterName} color={colors.cyan} />
                <StatPill label={clusterInfo.kubernetesVersion} />
              </>
            ) : undefined
          }
          expanded={expanded.cluster}
          onToggle={() => toggleSection('cluster')}
        >
          {clusterLoading ? (
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <Box key={i}>
                  <Skeleton width={80} height={16} sx={{ mb: 0.5 }} />
                  <Skeleton width={180} height={20} />
                </Box>
              ))}
            </Box>
          ) : clusterInfo ? (
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}
            >
              <FieldRow label="API Server" value={clusterInfo.apiServer} mono />
              <FieldRow label="Cluster Name" value={clusterInfo.clusterName} />
              <FieldRow label="Kubernetes Version" value={clusterInfo.kubernetesVersion} />
              <FieldRow label="Auth Mode" value={clusterInfo.authMode} />
            </Box>
          ) : (
            <Alert severity="error">Failed to load cluster information</Alert>
          )}
        </SettingsSection>

        {/* ── Appearance & Preferences ──────────────────────────────── */}
        <SettingsSection
          icon={<PaletteIcon fontSize="small" />}
          title="Appearance & Preferences"
          subtitle="Theme and display settings"
          pills={
            <StatPill label={mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System'} />
          }
          expanded={expanded.appearance}
          onToggle={() => toggleSection('appearance')}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 1.5,
            }}
          >
            Theme
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v as ThemeMode)}
            size="small"
          >
            <ToggleButton value="light" sx={{ gap: 0.5, textTransform: 'none', px: 2 }}>
              <LightModeIcon fontSize="small" /> Light
            </ToggleButton>
            <ToggleButton value="system" sx={{ gap: 0.5, textTransform: 'none', px: 2 }}>
              <SettingsBrightnessIcon fontSize="small" /> System
            </ToggleButton>
            <ToggleButton value="dark" sx={{ gap: 0.5, textTransform: 'none', px: 2 }}>
              <DarkModeIcon fontSize="small" /> Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </SettingsSection>

        {/* ── Security & Sessions ───────────────────────────────────── */}
        <SettingsSection
          icon={<SecurityIcon fontSize="small" />}
          title="Security & Sessions"
          subtitle="Active sessions and access management"
          pills={
            <>
              {sessionCount > 0 && (
                <StatPill label={`${sessionCount} sessions`} color={colors.warning} />
              )}
              {oidcEnabled && <StatPill label="OIDC connected" color={colors.success} />}
            </>
          }
          expanded={expanded.security}
          onToggle={() => toggleSection('security')}
        >
          <SessionsTable sessions={sessions} isLoading={sessionsLoading} isError={sessionsError} />
        </SettingsSection>

        {/* ── System Pulse ──────────────────────────────────────────── */}
        <SettingsSection
          icon={<MonitorHeartIcon fontSize="small" />}
          title="System Pulse"
          subtitle="Scheduler health, execution timing, and cache status"
          pills={
            guardrails ? (
              <>
                <StatPill label={`Eval: ${guardrails.schedulerEvalInterval}`} />
              </>
            ) : undefined
          }
          expanded={expanded.pulse}
          onToggle={() => toggleSection('pulse')}
        >
          {guardrails ? (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                  gap: 2,
                }}
              >
                <PulseStat label="Eval Interval" value={guardrails.schedulerEvalInterval} />
                <PulseStat label="Concurrency" value={String(guardrails.scalingConcurrency)} />
                <PulseStat label="Wake Wave Size" value={String(guardrails.wakeWaveSize)} />
                <PulseStat label="Wave Pause" value={`${guardrails.wakeWavePauseSeconds}s`} />
                <PulseStat label="Auto-Wake" value={guardrails.schedulerAutoWake ? 'ON' : 'OFF'} />
                <PulseStat
                  label="Enforce Sleep"
                  value={guardrails.schedulerEnforceSleep ? 'ON' : 'OFF'}
                />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                  label="Scheduler running"
                  size="small"
                  sx={{
                    bgcolor: colors.successBg,
                    color: colors.success,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
                <Chip
                  icon={<LinkIcon sx={{ fontSize: 14 }} />}
                  label="API reachable"
                  size="small"
                  sx={{
                    bgcolor: colors.successBg,
                    color: colors.success,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="rounded" height={56} />
              ))}
            </Box>
          )}
        </SettingsSection>

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        {showDanger && (
          <SettingsSection
            icon={<WarningAmberIcon fontSize="small" sx={{ color: colors.error }} />}
            title="Danger Zone"
            subtitle="Destructive operations — proceed with extreme caution"
            tinted="red"
            expanded={expanded.danger}
            onToggle={() => toggleSection('danger')}
          >
            <DatabaseSettings permissions={user?.permissions} bare />
          </SettingsSection>
        )}

        {/* ── About ─────────────────────────────────────────────────── */}
        <SettingsSection
          icon={<InfoIcon fontSize="small" />}
          title="About"
          subtitle="Version, build info, dependencies, and links"
          pills={versionInfo ? <StatPill label={versionInfo.version} /> : undefined}
          expanded={expanded.about}
          onToggle={() => toggleSection('about')}
        >
          <VersionDetails versionInfo={versionInfo} isLoading={versionLoading} />
        </SettingsSection>
      </Box>
      {SnackbarAlert}
    </>
  )
}
