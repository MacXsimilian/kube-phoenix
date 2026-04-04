'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'

type HealthState = 'healthy' | 'degraded' | 'critical'

const STATE_CONFIG: Record<HealthState, { color: string; label: string; cycleDuration: string; ringCount: number }> = {
  healthy:  { color: '#22C55E', label: 'Cluster Healthy', cycleDuration: '3s', ringCount: 2 },
  degraded: { color: '#F59E0B', label: 'Cluster Degraded', cycleDuration: '1.5s', ringCount: 3 },
  critical: { color: '#EF4444', label: 'Cluster Critical', cycleDuration: '0.8s', ringCount: 4 },
}

export default function HeartbeatPulsePrototype() {
  const router = useRouter()
  const [state, setState] = useState<HealthState>('healthy')
  const cfg = STATE_CONFIG[state]

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>B1 — Heartbeat Pulse</Typography>
          <Typography variant="body2" color="text.secondary">
            Cluster status indicator with health-dependent pulse cadence
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">State:</Typography>
        <ToggleButtonGroup
          value={state}
          exclusive
          onChange={(_, v) => v && setState(v)}
          size="small"
        >
          <ToggleButton value="healthy" sx={{ fontSize: 12, px: 2 }}>Healthy</ToggleButton>
          <ToggleButton value="degraded" sx={{ fontSize: 12, px: 2 }}>Degraded</ToggleButton>
          <ToggleButton value="critical" sx={{ fontSize: 12, px: 2 }}>Critical</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Cycle: {cfg.cycleDuration}
        </Typography>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 4,
        }}
      >
        {/* Pulse indicator — large demo */}
        <Box
          sx={{
            position: 'relative',
            width: 200,
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Concentric rings */}
          {Array.from({ length: cfg.ringCount }).map((_, i) => (
            <Box
              key={`${state}-ring-${i}`}
              sx={{
                position: 'absolute',
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: `2px solid ${cfg.color}`,
                animation: `pulseRing ${cfg.cycleDuration} ease-out infinite`,
                animationDelay: `${i * (parseFloat(cfg.cycleDuration) / cfg.ringCount)}s`,
                '@keyframes pulseRing': {
                  '0%': { transform: 'scale(1)', opacity: 0.6 },
                  '100%': { transform: 'scale(4.5)', opacity: 0 },
                },
              }}
            />
          ))}

          {/* Core dot */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: cfg.color,
              boxShadow: `0 0 20px ${cfg.color}, 0 0 40px ${cfg.color}40`,
              zIndex: 1,
              animation: `corePulse ${cfg.cycleDuration} ease-in-out infinite`,
              transition: 'background-color 500ms ease, box-shadow 500ms ease',
              '@keyframes corePulse': {
                '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.15)', opacity: 0.8 },
              },
            }}
          />
        </Box>

        {/* Status label */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ color: cfg.color, transition: 'color 500ms ease' }}
          >
            {cfg.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {state === 'healthy' && '3 nodes, 24 pods — all healthy'}
            {state === 'degraded' && '3 nodes, 2 pods unhealthy — investigating'}
            {state === 'critical' && '1 node NotReady, 8 pods CrashLoopBackOff'}
          </Typography>
        </Box>

        {/* Inline variant — how it looks in a status bar */}
        <Box sx={{ mt: 4, width: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Inline variant (as it appears in the status bar):
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ position: 'relative', width: 10, height: 10 }}>
              <Box
                key={`${state}-inline-ring`}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: `1.5px solid ${cfg.color}`,
                  animation: `inlineRing ${cfg.cycleDuration} ease-out infinite`,
                  '@keyframes inlineRing': {
                    '0%': { transform: 'scale(1)', opacity: 0.5 },
                    '100%': { transform: 'scale(3)', opacity: 0 },
                  },
                }}
              />
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: cfg.color,
                  boxShadow: `0 0 8px ${cfg.color}`,
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </Box>
            <Typography variant="body2" fontWeight={600}>{cfg.label}</Typography>
            <Typography variant="caption" color="text.secondary">·</Typography>
            <Typography variant="caption" color="text.secondary">3 Nodes · 24 Workloads</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
