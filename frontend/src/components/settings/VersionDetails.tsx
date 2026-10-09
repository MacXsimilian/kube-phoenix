'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import GitHubIcon from '@mui/icons-material/GitHub'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useColors } from '@/lib/colors'
import { useIsDark } from '@/lib/useIsDark'
import { subtleBorder } from '@/lib/statusColors'
import type { VersionInfo } from '@/lib/types'
import { FieldRow } from './SettingsFields'
import pkg from '../../../package.json'

const stripVersionRange = (version: string) => version.replace(/^[\^~]/, '')
const FRONTEND_VERSIONS = {
  next: stripVersionRange(pkg.dependencies.next),
  typescript: stripVersionRange(pkg.devDependencies.typescript),
  mui: stripVersionRange(pkg.dependencies['@mui/material']),
  react: stripVersionRange(pkg.dependencies.react),
  tanstackQuery: stripVersionRange(pkg.dependencies['@tanstack/react-query']),
}

interface VersionDetailsProps {
  versionInfo: VersionInfo | undefined
  isLoading: boolean
}

export default function VersionDetails({ versionInfo, isLoading }: VersionDetailsProps) {
  const isDark = useIsDark()
  const colors = useColors()
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center', py: 3 }}>
        <Skeleton width={200} height={32} />
        <Skeleton width={100} height={24} />
      </Box>
    )
  }

  if (!versionInfo) {
    return <Alert severity="error">Failed to load version information</Alert>
  }

  return (
    <>
      <Box
        sx={{
          textAlign: 'center',
          py: 2,
          mb: 2,
          borderBottom: `1px solid ${subtleBorder(isDark)}`,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            mb: 0.5,
          }}
        >
          🐦‍🔥 kube-phoenix
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: 'text.secondary',
            fontFamily: 'monospace',
          }}
        >
          {versionInfo.version}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          Kubernetes cluster sleep/wake policy engine
        </Typography>
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          mb: 1.5,
        }}
      >
        Build Information
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <FieldRow label="Version" value={versionInfo.version} mono />
        <FieldRow label="Uptime" value={versionInfo.uptime} />
        <Divider sx={{ gridColumn: '1 / -1', my: 0.5 }} />
        <FieldRow label="Go Version" value={versionInfo.goVersion} mono />
        <FieldRow label="Next.js" value={FRONTEND_VERSIONS.next} mono />
        <FieldRow label="TypeScript" value={FRONTEND_VERSIONS.typescript} mono />
        <FieldRow label="MUI" value={FRONTEND_VERSIONS.mui} mono />
        <FieldRow label="React" value={FRONTEND_VERSIONS.react} mono />
        <FieldRow label="TanStack Query" value={FRONTEND_VERSIONS.tanstackQuery} mono />
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          mb: 1,
        }}
      >
        Links
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[
          {
            label: 'GitHub Repository',
            icon: <GitHubIcon fontSize="small" />,
            href: 'https://github.com/MacXsimilian/kube-phoenix',
          },
          {
            label: 'Documentation',
            icon: <OpenInNewIcon fontSize="small" />,
            href: 'https://github.com/MacXsimilian/kube-phoenix/tree/master/docs',
          },
          {
            label: 'Changelog',
            icon: <OpenInNewIcon fontSize="small" />,
            href: 'https://github.com/MacXsimilian/kube-phoenix/blob/master/CHANGELOG.md',
          },
          {
            label: 'API Reference (Swagger)',
            icon: <OpenInNewIcon fontSize="small" />,
            href: '/api/docs/',
          },
        ].map((link) => (
          <Box
            key={link.label}
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 0.5,
              color: colors.info,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {link.icon}
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
              }}
            >
              {link.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </>
  )
}
