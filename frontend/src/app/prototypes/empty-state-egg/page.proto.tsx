'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import AddIcon from '@mui/icons-material/Add'
import { useRouter } from 'next/navigation'

type EmptyVariant = 'policies' | 'executions' | 'exceptions'

const VARIANTS: Record<EmptyVariant, { title: string; subtitle: string; cta: string }> = {
  policies: {
    title: 'No policies yet',
    subtitle: 'Create your first sleep/wake policy to start saving on cluster costs.',
    cta: 'Create Policy',
  },
  executions: {
    title: 'No executions',
    subtitle: 'Run a sleep or wake to see execution history and logs here.',
    cta: 'Go to Policies',
  },
  exceptions: {
    title: 'No scheduled exceptions',
    subtitle: 'Exceptions let you override policy schedules for deployments, incidents, or maintenance.',
    cta: 'Create Exception',
  },
}

function PhoenixEggSVG({ variant }: { variant: EmptyVariant }) {
  const color = variant === 'policies' ? '#7C3AED' : variant === 'executions' ? '#3B82F6' : '#F59E0B'

  return (
    <svg width="120" height="140" viewBox="0 0 120 140" fill="none">
      {/* Egg outline — draws itself */}
      <ellipse
        cx="60" cy="72" rx="36" ry="48"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
        style={{
          strokeDasharray: 280,
          strokeDashoffset: 280,
          animation: 'eggDraw 1.5s ease-out forwards',
        }}
      />

      {/* Inner glow */}
      <ellipse
        cx="60" cy="72" rx="20" ry="28"
        fill={`${color}15`}
        style={{
          animation: 'eggGlow 3s ease-in-out infinite',
          transformOrigin: '60px 72px',
        }}
      />

      {/* Phoenix feather — small decorative stroke */}
      <path
        d="M60 38 Q65 28 72 22 Q68 30 66 40"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
        style={{
          strokeDasharray: 50,
          strokeDashoffset: 50,
          animation: 'featherDraw 1s ease-out 0.8s forwards',
        }}
      />
      <path
        d="M60 38 Q55 28 48 22 Q52 30 54 40"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
        style={{
          strokeDasharray: 50,
          strokeDashoffset: 50,
          animation: 'featherDraw 1s ease-out 1s forwards',
        }}
      />

      {/* Small sparkle dots */}
      {[
        { cx: 30, cy: 50, delay: '1.2s' },
        { cx: 90, cy: 60, delay: '1.5s' },
        { cx: 45, cy: 110, delay: '1.8s' },
        { cx: 80, cy: 100, delay: '2s' },
      ].map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r="2"
          fill={color}
          opacity="0"
          style={{
            animation: `sparkle 2s ease-in-out ${dot.delay} infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes eggDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes eggGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        @keyframes featherDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 0.6; transform: scale(1); }
        }
      `}</style>
    </svg>
  )
}

export default function EmptyStateEggPrototype() {
  const router = useRouter()
  const [variant, setVariant] = useState<EmptyVariant>('policies')
  const [key, setKey] = useState(0)
  const cfg = VARIANTS[variant]

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F24 — Empty State Egg</Typography>
          <Typography variant="body2" color="text.secondary">
            SVG line-draw phoenix egg with inner glow pulse and sparkle particles
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={variant}
          exclusive
          onChange={(_, v) => { if (v) { setVariant(v); setKey(k => k + 1) } }}
          size="small"
        >
          <ToggleButton value="policies" sx={{ fontSize: 12, px: 2 }}>Policies</ToggleButton>
          <ToggleButton value="executions" sx={{ fontSize: 12, px: 2 }}>Executions</ToggleButton>
          <ToggleButton value="exceptions" sx={{ fontSize: 12, px: 2 }}>Exceptions</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setKey(k => k + 1)}>
          Replay
        </Button>
      </Box>

      <Box
        key={key}
        sx={{
          py: 8, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}
      >
        <PhoenixEggSVG variant={variant} />

        <Box
          sx={{
            textAlign: 'center',
            animation: 'textFadeIn 0.5s ease-out 0.5s both',
            '@keyframes textFadeIn': {
              from: { opacity: 0, transform: 'translateY(8px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            {cfg.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto' }}>
            {cfg.subtitle}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            animation: 'ctaPulse 2s ease-in-out 1.5s infinite',
            '@keyframes ctaPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,58,237,0)' },
              '50%': { boxShadow: '0 0 0 6px rgba(124,58,237,0.15)' },
            },
          }}
        >
          {cfg.cta}
        </Button>
      </Box>
    </Box>
  )
}
