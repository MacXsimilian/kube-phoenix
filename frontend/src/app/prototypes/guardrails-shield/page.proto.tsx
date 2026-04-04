'use client'

import { useState, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

type ShieldState = 'idle' | 'checking' | 'blocked' | 'allowed'

const SCENARIOS = [
  { label: 'Sleep dev namespace', result: 'allowed' as const, reason: 'No guardrail violations' },
  { label: 'Sleep kube-system', result: 'blocked' as const, reason: 'System namespace protected by guardrails' },
  { label: 'Drain node-2', result: 'blocked' as const, reason: 'Node hosts critical pods (protectCriticalPodNodes=true)' },
  { label: 'Sleep team-payments', result: 'blocked' as const, reason: 'Namespace in protected list' },
  { label: 'Sleep staging', result: 'allowed' as const, reason: 'Policy namespace filter matches' },
]

const STATE_CONFIG = {
  idle: { color: '#94A3B8', glow: 'none', label: 'Ready' },
  checking: { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', label: 'Checking...' },
  blocked: { color: '#EF4444', glow: 'rgba(239,68,68,0.4)', label: 'Blocked' },
  allowed: { color: '#22C55E', glow: 'rgba(34,197,94,0.3)', label: 'Allowed' },
}

export default function GuardrailsShieldPrototype() {
  const router = useRouter()
  const [state, setState] = useState<ShieldState>('idle')
  const [lastReason, setLastReason] = useState('')
  const [log, setLog] = useState<string[]>([])
  const shieldRef = useRef<HTMLDivElement>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const runScenario = useCallback((scenario: typeof SCENARIOS[0]) => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setState('checking')
    setLastReason('')
    setLog(prev => [...prev, `Evaluating: ${scenario.label}...`])

    if (shieldRef.current) {
      gsap.to(shieldRef.current, { rotation: 5, duration: 0.1, yoyo: true, repeat: 3, ease: 'power2.inOut' })
    }

    const t = setTimeout(() => {
      setState(scenario.result)
      setLastReason(scenario.reason)
      setLog(prev => [...prev, `→ ${scenario.result.toUpperCase()}: ${scenario.reason}`])

      if (shieldRef.current) {
        if (scenario.result === 'blocked') {
          gsap.fromTo(shieldRef.current, { x: 0 }, { x: -4, duration: 0.05, yoyo: true, repeat: 5 })
        } else {
          gsap.fromTo(shieldRef.current, { scale: 1 }, { scale: 1.1, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' })
        }
      }

      const t2 = setTimeout(() => setState('idle'), 3000)
      timeoutsRef.current.push(t2)
    }, 800)
    timeoutsRef.current.push(t)
  }, [])

  const cfg = STATE_CONFIG[state]

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G7 — Guardrails Shield</Typography>
          <Typography variant="body2" color="text.secondary">
            Animated shield that reacts to guardrail checks — shake on block, pulse on allow
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
        {SCENARIOS.map(s => (
          <Button
            key={s.label}
            variant="outlined"
            size="small"
            onClick={() => runScenario(s)}
            disabled={state === 'checking'}
            sx={{ fontSize: 11, borderColor: s.result === 'blocked' ? 'rgba(239,68,68,0.3)' : 'divider' }}
          >
            {s.label}
          </Button>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Shield visualization */}
        <Box sx={{ p: 4, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box
            ref={shieldRef}
            sx={{
              width: 100,
              height: 100,
              borderRadius: '20px',
              bgcolor: `${cfg.color}15`,
              border: `2px solid ${cfg.color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 400ms ease, border-color 400ms ease',
              boxShadow: cfg.glow !== 'none' ? `0 0 20px ${cfg.glow}` : 'none',
              ...(state === 'checking' && {
                animation: 'shieldSpin 0.8s ease-in-out',
                '@keyframes shieldSpin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '25%': { transform: 'rotate(5deg)' },
                  '75%': { transform: 'rotate(-5deg)' },
                  '100%': { transform: 'rotate(0deg)' },
                },
              }),
            }}
          >
            {state === 'blocked'
              ? <BlockIcon sx={{ fontSize: 48, color: cfg.color }} />
              : state === 'allowed'
                ? <CheckCircleOutlineIcon sx={{ fontSize: 48, color: cfg.color }} />
                : <ShieldOutlinedIcon sx={{ fontSize: 48, color: cfg.color }} />}
          </Box>

          <Chip
            label={cfg.label}
            size="small"
            sx={{
              bgcolor: `${cfg.color}18`,
              color: cfg.color,
              fontWeight: 600,
              transition: 'background-color 400ms ease, color 400ms ease',
            }}
          />

          {lastReason && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 250 }}>
              {lastReason}
            </Typography>
          )}
        </Box>

        {/* Evaluation log */}
        <Box sx={{
          p: 1.5, borderRadius: 2, bgcolor: '#0A0A0F', border: '1px solid', borderColor: 'divider',
          fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, maxHeight: 300, overflow: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
        }}>
          {log.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
              Click a scenario to evaluate guardrails
            </Typography>
          )}
          {log.map((line, i) => (
            <Box key={i} sx={{
              borderLeft: line.startsWith('→ BLOCKED') ? '3px solid #EF4444' : line.startsWith('→ ALLOWED') ? '3px solid #22C55E' : '3px solid transparent',
              pl: 1,
              color: line.startsWith('→ BLOCKED') ? '#F87171' : line.startsWith('→ ALLOWED') ? '#86efac' : 'inherit',
              animation: 'gsLogIn 200ms ease-out',
              '@keyframes gsLogIn': { from: { opacity: 0, transform: 'translateX(8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
            }}>
              {line}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
