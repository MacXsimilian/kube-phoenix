'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import LaptopIcon from '@mui/icons-material/Laptop'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness'
import GitHubIcon from '@mui/icons-material/GitHub'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useColors } from '@/lib/colors'
import { useIsDark } from '@/lib/useIsDark'
import { LED_COLORS, subtleBorder } from '@/lib/statusColors'
import { useThemeMode, type ThemeMode } from '@/lib/themeMode'
import { useAuth } from '@/lib/auth'
import { useSnackbar } from '@/lib/useSnackbar'
import { canResetDB, canEmergencyScale } from '@/lib/rbac'
import { TIMEZONES } from '@/lib/constants'
import { podAge } from '@/lib/formatters'
import {
  getClusterInfo,
  getVersionInfo,
  getSessions,
  getOIDCConfig,
  getGuardrails,
  updateUserSettings,
} from '@/lib/api'
import DatabaseSettings from '@/components/settings/DatabaseSettings'

/* ─── Helpers ───────────────────────────────────────────────────────────���─── */

function parseDevice(ua: string): { icon: React.ReactNode; label: string } {
  if (/iPhone|iPad|Android/.test(ua)) return { icon: <PhoneIphoneIcon fontSize="small" />, label: 'Mobile' }
  if (/Macintosh|Windows|Linux/.test(ua)) return { icon: <LaptopIcon fontSize="small" />, label: 'Desktop' }
  return { icon: <DesktopWindowsIcon fontSize="small" />, label: 'Unknown' }
}

function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge'
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return 'Chrome'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  return 'Unknown'
}

/* ─── Section (collapsible card, matches guardrails CategoryCard) ─────────── */

interface SectionProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  pills?: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  tinted?: 'red'
}

function Section({ icon, title, subtitle, pills, expanded, onToggle, children, tinted }: SectionProps) {
  const isDark = useIsDark()
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: tinted === 'red' ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)') : undefined,
        borderColor: tinted === 'red' ? (isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)') : undefined,
      }}
    >
      <Box onClick={onToggle} sx={{ cursor: 'pointer' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'action.hover',
              }}
            >
              {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                  fontSize: 14
                }}>{title}</Typography>
              <Typography variant="caption" sx={{
                color: "text.secondary"
              }}>{subtitle}</Typography>
            </Box>
            {!expanded && pills && (
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {pills}
              </Box>
            )}
            <ExpandMoreIcon
              fontSize="small"
              sx={{ color: 'text.secondary', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
            />
          </Box>
        </CardContent>
      </Box>
      <Collapse in={expanded}>
        <Divider />
        <CardContent sx={{ px: 2.5, pb: 2.5, pt: 1.5 }}>
          {children}
        </CardContent>
      </Collapse>
    </Card>
  );
}

/* ─── Shared sub-components ───────────────────────────────────────────────── */

function StatPill({ label, color }: { label: string; color?: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 20, fontSize: 11, fontWeight: 600,
        bgcolor: color ? `${color}18` : 'rgba(255,255,255,0.06)',
        color: color ?? 'text.secondary',
        border: '1px solid',
        borderColor: color ? `${color}30` : 'divider',
      }}
    />
  )
}

function LedDot({ state }: { state: keyof typeof LED_COLORS }) {
  const led = LED_COLORS[state]
  return (
    <Box
      sx={{
        width: 10, height: 10, borderRadius: '50%',
        bgcolor: led.bg,
        boxShadow: `0 0 6px ${led.glow}`,
        animation: state === 'awake' ? 'pulse-led 2s ease-in-out infinite' : undefined,
        '@keyframes pulse-led': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      }}
    />
  )
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          display: 'block',
          mb: 0.25
        }}>{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 12 : 13,
          wordBreak: 'break-all'
        }}>
        {value}
      </Typography>
    </Box>
  );
}

function PulseStat({ label, value }: { label: string; value: string }) {
  const isDark = useIsDark()
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          fontSize: 16
        }}>{value}</Typography>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontSize: 10
        }}>{label}</Typography>
    </Box>
  );
}

/* ─── Main Page ─���─────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const isDark = useIsDark()
  const colors = useColors()
  const { mode, setMode } = useThemeMode()
  const { user, refreshUser } = useAuth()
  const { notify, SnackbarAlert } = useSnackbar()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    profile: true,
    cluster: false,
    appearance: false,
    security: false,
    pulse: false,
    danger: false,
    about: false,
  })

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

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

  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useQuery({
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
  const timezoneMut = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => { refreshUser(); notify('Timezone updated', 'success') },
    onError: (err: Error) => notify(err.message || 'Failed to update timezone', 'error'),
  })

  const handleTimezoneChange = (tz: string) => timezoneMut.mutate({ defaultTimezone: tz })

  /* ── Derived values ───────────────────────────────────────────────── */
  const showDanger = canResetDB(user?.permissions) || canEmergencyScale(user?.permissions)
  const oidcEnabled = oidcConfig?.enabled ?? false
  const oidcMounted = oidcConfig?.mounted ?? false
  const sessionCount = sessions?.length ?? 0

  return (
    <>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1
        }}>Settings</Typography>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 3
        }}>
        Manage your account, appearance, and system configuration.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* ── Profile & Identity ────────────────────────────────────── */}
        {user && user.id !== 0 && (
          <Section
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
            onToggle={() => toggle('profile')}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <FieldRow label="Username" value={user.username} />
              <FieldRow label="Role" value={user.role} />
              <FieldRow label="Auth Source" value={user.source === 'oidc' ? 'SSO (OIDC)' : 'Local'} />
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    mb: 0.5,
                    display: 'block'
                  }}>Timezone</Typography>
                <Select
                  size="small"
                  value={user.defaultTimezone ?? 'UTC'}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  disabled={timezoneMut.isPending}
                  fullWidth
                  sx={{ fontSize: 13 }}
                  MenuProps={{ slotProps: { paper: { sx: { maxHeight: 300 } } } }}
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz} sx={{ fontSize: 13 }}>{tz}</MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

            {/* OIDC Details */}
            {oidcMounted && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${subtleBorder(isDark)}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 600
                  }}>OIDC Connection</Typography>
                  <LedDot state={oidcEnabled ? 'awake' : 'unknown'} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                  {oidcConfig?.issuerURL && <FieldRow label="Issuer" value={oidcConfig.issuerURL} mono />}
                  {oidcConfig?.clientID && <FieldRow label="Client ID" value={oidcConfig.clientID} mono />}
                  {oidcConfig?.redirectURL && <FieldRow label="Redirect URL" value={oidcConfig.redirectURL} mono />}
                  <FieldRow label="Status" value={oidcEnabled ? 'Connected' : 'Not initialized'} />
                </Box>
              </Box>
            )}
          </Section>
        )}

        {/* ── Cluster & Connection ──────────────────────────────────── */}
        <Section
          icon={<StorageIcon fontSize="small" />}
          title="Cluster & Connection"
          subtitle="Kubernetes cluster details and API server status"
          pills={clusterInfo ? (
            <>
              <StatPill label={clusterInfo.clusterName} color={colors.cyan} />
              <StatPill label={clusterInfo.kubernetesVersion} />
            </>
          ) : undefined}
          expanded={expanded.cluster}
          onToggle={() => toggle('cluster')}
        >
          {clusterLoading ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {[0, 1, 2, 3].map((i) => (
                <Box key={i}><Skeleton width={80} height={16} sx={{ mb: 0.5 }} /><Skeleton width={180} height={20} /></Box>
              ))}
            </Box>
          ) : clusterInfo ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <FieldRow label="API Server" value={clusterInfo.apiServer} mono />
              <FieldRow label="Cluster Name" value={clusterInfo.clusterName} />
              <FieldRow label="Kubernetes Version" value={clusterInfo.kubernetesVersion} />
              <FieldRow label="Auth Mode" value={clusterInfo.authMode} />
            </Box>
          ) : (
            <Alert severity="error">Failed to load cluster information</Alert>
          )}
        </Section>

        {/* ── Appearance & Preferences ──────────────────────────────── */}
        <Section
          icon={<PaletteIcon fontSize="small" />}
          title="Appearance & Preferences"
          subtitle="Theme and display settings"
          pills={<StatPill label={mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System'} />}
          expanded={expanded.appearance}
          onToggle={() => toggle('appearance')}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 1.5
            }}>Theme</Typography>
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
        </Section>

        {/* ── Security & Sessions ───────────────────────────────────── */}
        <Section
          icon={<SecurityIcon fontSize="small" />}
          title="Security & Sessions"
          subtitle="Active sessions and access management"
          pills={
            <>
              {sessionCount > 0 && <StatPill label={`${sessionCount} sessions`} color={colors.warning} />}
              {oidcEnabled && <StatPill label="OIDC connected" color={colors.success} />}
            </>
          }
          expanded={expanded.security}
          onToggle={() => toggle('security')}
        >
          {sessionsError ? (
            <Alert severity="error">Could not load sessions.</Alert>
          ) : sessionsLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Skeleton variant="rounded" height={40} />
              <Skeleton variant="rounded" height={40} />
            </Box>
          ) : sessions && sessions.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Device</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>IP Address</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Browser</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s) => {
                  const device = parseDevice(s.userAgent)
                  return (
                    <TableRow key={s.id} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontSize: 12 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {device.icon}
                          {device.label}
                          {s.isCurrent && (
                            <Chip label="Current" size="small" sx={{ ml: 0.5, height: 18, fontSize: 10, bgcolor: colors.successBg, color: colors.success }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{s.ipAddress}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{parseBrowser(s.userAgent)}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{podAge(s.createdAt)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>No active sessions found.</Typography>
          )}
        </Section>

        {/* ── System Pulse ──────────────────────────────────────────── */}
        <Section
          icon={<MonitorHeartIcon fontSize="small" />}
          title="System Pulse"
          subtitle="Scheduler health, execution timing, and cache status"
          pills={guardrails ? (
            <>
              <StatPill label={`Eval: ${guardrails.schedulerEvalInterval}`} />
            </>
          ) : undefined}
          expanded={expanded.pulse}
          onToggle={() => toggle('pulse')}
        >
          {guardrails ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <PulseStat label="Eval Interval" value={guardrails.schedulerEvalInterval} />
                <PulseStat label="Concurrency" value={String(guardrails.scalingConcurrency)} />
                <PulseStat label="Wake Wave Size" value={String(guardrails.wakeWaveSize)} />
                <PulseStat label="Wave Pause" value={`${guardrails.wakeWavePauseSeconds}s`} />
                <PulseStat label="Auto-Wake" value={guardrails.schedulerAutoWake ? 'ON' : 'OFF'} />
                <PulseStat label="Enforce Sleep" value={guardrails.schedulerEnforceSleep ? 'ON' : 'OFF'} />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                  label="Scheduler running"
                  size="small"
                  sx={{ bgcolor: colors.successBg, color: colors.success, fontWeight: 600, fontSize: 11 }}
                />
                <Chip
                  icon={<LinkIcon sx={{ fontSize: 14 }} />}
                  label="API reachable"
                  size="small"
                  sx={{ bgcolor: colors.successBg, color: colors.success, fontWeight: 600, fontSize: 11 }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}
            </Box>
          )}
        </Section>

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        {showDanger && (
          <Section
            icon={<WarningAmberIcon fontSize="small" sx={{ color: colors.error }} />}
            title="Danger Zone"
            subtitle="Destructive operations — proceed with extreme caution"
            tinted="red"
            expanded={expanded.danger}
            onToggle={() => toggle('danger')}
          >
            <DatabaseSettings permissions={user?.permissions} bare />
          </Section>
        )}

        {/* ── About ─────────────────────────────────────────────────── */}
        <Section
          icon={<InfoIcon fontSize="small" />}
          title="About"
          subtitle="Version, build info, dependencies, and links"
          pills={versionInfo ? <StatPill label={versionInfo.version} /> : undefined}
          expanded={expanded.about}
          onToggle={() => toggle('about')}
        >
          {versionLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center', py: 3 }}>
              <Skeleton width={200} height={32} />
              <Skeleton width={100} height={24} />
            </Box>
          ) : versionInfo ? (
            <>
              <Box sx={{ textAlign: 'center', py: 2, mb: 2, borderBottom: `1px solid ${subtleBorder(isDark)}` }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    mb: 0.5
                  }}>🐦‍🔥 kube-phoenix</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: "text.secondary",
                    fontFamily: 'monospace'
                  }}>{versionInfo.version}</Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>Kubernetes cluster sleep/wake policy engine</Typography>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  mb: 1.5
                }}>Build Information</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
                <FieldRow label="Version" value={versionInfo.version} mono />
                <FieldRow label="Uptime" value={versionInfo.uptime} />
                <Divider sx={{ gridColumn: '1 / -1', my: 0.5 }} />
                <FieldRow label="Go Version" value={versionInfo.goVersion} mono />
                <FieldRow label="Next.js" value="16.0.0" mono />
                <FieldRow label="TypeScript" value="6.0.0" mono />
                <FieldRow label="MUI" value="7.1.0" mono />
                <FieldRow label="React" value="19.1.0" mono />
                <FieldRow label="TanStack Query" value="5.72.2" mono />
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  mb: 1
                }}>Links</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: 'GitHub Repository', icon: <GitHubIcon fontSize="small" />, href: 'https://github.com/MacXsimilian/kube-phoenix' },
                  { label: 'Documentation', icon: <OpenInNewIcon fontSize="small" />, href: 'https://github.com/MacXsimilian/kube-phoenix/tree/master/docs' },
                  { label: 'Changelog', icon: <OpenInNewIcon fontSize="small" />, href: 'https://github.com/MacXsimilian/kube-phoenix/blob/master/CHANGELOG.md' },
                  { label: 'API Reference (Swagger)', icon: <OpenInNewIcon fontSize="small" />, href: '/api/docs/' },
                ].map((link) => (
                  <Box
                    key={link.label}
                    component="a"
                    href={link.href}
                    target="_blank"
                    rel="noopener"
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, py: 0.5,
                      color: colors.info, textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {link.icon}
                    <Typography variant="body2" sx={{
                      fontSize: 13
                    }}>{link.label}</Typography>
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            <Alert severity="error">Failed to load version information</Alert>
          )}
        </Section>
      </Box>
      {SnackbarAlert}
    </>
  );
}
