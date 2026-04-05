'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import LoginIcon from '@mui/icons-material/Login'
import { getOIDCConfig } from '@/lib/api'

const LABEL_SX = { textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 } as const

function GroupChipList({ label, groups, chipColor }: { label: string; groups?: string[]; chipColor: 'error' | 'warning' }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={LABEL_SX}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {groups?.length
          ? groups.map((g) => (
              <Chip key={g} label={g} size="small" color={chipColor} variant="outlined" />
            ))
          : <Typography variant="body2" color="text.disabled">{'\u2014'}</Typography>}
      </Box>
    </Box>
  )
}

function StatusIndicator({ color, bgColor, label }: { color: string; bgColor: string; label: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 2,
        py: 1.25,
        borderRadius: 1,
        bgcolor: bgColor,
        mb: 2.5,
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: `${color}.main`,
          ...(color === 'success' && {
            boxShadow: '0 0 6px',
            color: 'success.main',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
            animation: 'pulse 2s ease-in-out infinite',
          }),
        }}
      />
      <Typography variant="body2" fontWeight={500} color={`${color}.main`}>
        {label}
      </Typography>
    </Box>
  )
}

export default function OIDCStatusCard() {
  const { data: oidcCfg, isLoading, isError } = useQuery({
    queryKey: queryKeys.oidcConfig(),
    queryFn: getOIDCConfig,
  })

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LoginIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            OIDC / SSO
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          Single Sign-On provider configuration. These values are read from server environment variables and cannot be changed here.
        </Typography>

        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>Failed to load OIDC configuration</Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i}>
                <Skeleton width={80} height={16} sx={{ mb: 0.5 }} />
                <Skeleton width={180} height={20} />
              </Box>
            ))}
          </Box>
        ) : oidcCfg && (
          <>
            {/* Status bar */}
            {oidcCfg.enabled && (
              <StatusIndicator color="success" bgColor="rgba(34,197,94,0.08)" label="Provider connected and healthy" />
            )}

            {oidcCfg.mounted && !oidcCfg.enabled && (
              <StatusIndicator color="warning" bgColor="rgba(245,158,11,0.08)" label="Config mounted but provider failed to initialize" />
            )}

            {oidcCfg.mounted && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {[
                  { label: 'Issuer URL', value: oidcCfg.issuerURL, mono: true },
                  { label: 'Client ID', value: oidcCfg.clientID, mono: true },
                  { label: 'Redirect URL', value: oidcCfg.redirectURL, mono: true },
                  { label: 'Groups Claim', value: oidcCfg.groupsClaim, mono: true },
                ].map(({ label, value, mono }) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" sx={LABEL_SX}>
                      {label}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        fontFamily: mono ? 'monospace' : undefined,
                        fontSize: mono ? 12.5 : undefined,
                        wordBreak: 'break-all',
                        color: value ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {value || '\u2014'}
                    </Typography>
                  </Box>
                ))}

                <GroupChipList label="Admin Groups" groups={oidcCfg.roleAdminGroups} chipColor="error" />
                <GroupChipList label="Operator Groups" groups={oidcCfg.roleOperatorGroups} chipColor="warning" />
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
