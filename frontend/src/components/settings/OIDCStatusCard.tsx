'use client'

import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { getOIDCConfig } from '@/lib/api'

export default function OIDCStatusCard() {
  const { data: oidcCfg, isLoading, isError } = useQuery({
    queryKey: ['oidc-config'],
    queryFn: getOIDCConfig,
  })

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          OIDC / SSO
        </Typography>

        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>Failed to load OIDC configuration</Alert>
        )}

        {isLoading ? (
          <CircularProgress size={20} />
        ) : oidcCfg && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {oidcCfg.enabled ? (
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              ) : oidcCfg.mounted ? (
                <WarningAmberOutlinedIcon fontSize="small" color="warning" />
              ) : (
                <ErrorOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              )}
              <Typography variant="body2" fontWeight={600}>
                {oidcCfg.enabled
                  ? 'Active \u2014 provider initialized successfully'
                  : oidcCfg.mounted
                    ? 'Config mounted but provider failed to initialize'
                    : 'Not configured'}
              </Typography>
            </Box>

            {oidcCfg.mounted && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                {[
                  { label: 'Issuer URL', value: oidcCfg.issuerURL },
                  { label: 'Client ID', value: oidcCfg.clientID },
                  { label: 'Redirect URL', value: oidcCfg.redirectURL },
                  { label: 'Groups claim', value: oidcCfg.groupsClaim },
                ].map(({ label, value }) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{ wordBreak: 'break-all', color: value ? 'text.primary' : 'text.disabled' }}
                    >
                      {value || '\u2014'}
                    </Typography>
                  </Box>
                ))}

                <Box>
                  <Typography variant="caption" color="text.secondary">Admin groups</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {oidcCfg.roleAdminGroups?.length
                      ? oidcCfg.roleAdminGroups.map((g) => (
                          <Chip key={g} label={g} size="small" color="error" variant="outlined" />
                        ))
                      : <Typography variant="body2" color="text.disabled">{'\u2014'}</Typography>}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Operator groups</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {oidcCfg.roleOperatorGroups?.length
                      ? oidcCfg.roleOperatorGroups.map((g) => (
                          <Chip key={g} label={g} size="small" color="warning" variant="outlined" />
                        ))
                      : <Typography variant="body2" color="text.disabled">{'\u2014'}</Typography>}
                  </Box>
                </Box>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
