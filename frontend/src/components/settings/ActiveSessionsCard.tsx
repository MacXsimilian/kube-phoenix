'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MonitorIcon from '@mui/icons-material/Monitor'

export default function ActiveSessionsCard() {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <MonitorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Active Sessions
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Devices currently signed in to your account.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: 'rgba(124,58,237,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MonitorIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>
                This device
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current session
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              fontSize: 10.5,
              fontWeight: 600,
              px: 1,
              py: 0.25,
              borderRadius: '10px',
              bgcolor: 'rgba(34,197,94,0.08)',
              color: 'success.main',
            }}
          >
            Current
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
