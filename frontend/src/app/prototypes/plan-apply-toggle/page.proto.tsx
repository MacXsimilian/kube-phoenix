'use client'

import { useState, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'

type PolicyMode = 'plan' | 'apply'

const MODE_CONFIG = {
  plan: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Plan Mode', description: 'Dry-run only — executions are logged but nothing scales. Safe to experiment.' },
  apply: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Apply Mode', description: 'Live scaling — workloads will actually scale to zero on sleep and restore on wake.' },
}

export default function PlanApplyTogglePrototype() {
  const router = useRouter()
  const [mode, setMode] = useState<PolicyMode>('plan')
  const [confirming, setConfirming] = useState(false)
  const [animating, setAnimating] = useState(false)
  const toggleRef = useRef<HTMLDivElement>(null)
  const cfg = MODE_CONFIG[mode]

  const toggleMode = useCallback(() => {
    if (mode === 'plan') {
      setConfirming(true)
    } else {
      performSwitch('plan')
    }
  }, [mode])

  const performSwitch = useCallback((target: PolicyMode) => {
    setConfirming(false)
    setAnimating(true)

    if (toggleRef.current) {
      const tl = gsap.timeline({
        onComplete: () => { setMode(target); setAnimating(false) },
      })

      tl.to(toggleRef.current, { scale: 0.95, duration: 0.15, ease: 'power2.in' })
        .to(toggleRef.current, {
          boxShadow: target === 'apply'
            ? '0 0 30px rgba(245,158,11,0.3)'
            : '0 0 30px rgba(59,130,246,0.3)',
          duration: 0.3,
        })
        .to(toggleRef.current, { scale: 1, duration: 0.3, ease: 'back.out(1.7)' })
        .to(toggleRef.current, { boxShadow: '0 0 0px transparent', duration: 0.4 })
    } else {
      setMode(target)
      setAnimating(false)
    }
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>G8 — Plan / Apply Toggle</Typography>
          <Typography variant="body2" color="text.secondary">
            Weighted mode switch — applying requires confirmation with visual drama
          </Typography>
        </Box>
      </Box>

      {/* Toggle card */}
      <Box
        ref={toggleRef}
        sx={{
          p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          transition: 'border-color 400ms ease',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>EU Dev Sleep</Typography>
          <Box
            sx={{
              px: 1.5, py: 0.5, borderRadius: 1.5,
              bgcolor: cfg.bg, color: cfg.color,
              fontWeight: 700, fontSize: 13,
              transition: 'background-color 400ms ease, color 400ms ease',
            }}
          >
            {cfg.label.toUpperCase()}
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {cfg.description}
        </Typography>

        {/* Toggle track */}
        <Box
          onClick={animating ? undefined : toggleMode}
          sx={{
            position: 'relative', width: 200, height: 40, borderRadius: 20,
            bgcolor: mode === 'plan' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
            border: '1px solid',
            borderColor: mode === 'plan' ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)',
            cursor: animating ? 'default' : 'pointer',
            transition: 'background-color 400ms ease, border-color 400ms ease',
            display: 'flex', alignItems: 'center', px: 0.5,
          }}
        >
          {/* Labels */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute', left: 16, fontWeight: 600, fontSize: 11,
              color: mode === 'plan' ? 'transparent' : '#64748B',
              transition: 'color 300ms ease',
            }}
          >
            Plan
          </Typography>
          <Typography
            variant="caption"
            sx={{
              position: 'absolute', right: 16, fontWeight: 600, fontSize: 11,
              color: mode === 'apply' ? 'transparent' : '#64748B',
              transition: 'color 300ms ease',
            }}
          >
            Apply
          </Typography>

          {/* Thumb */}
          <motion.div
            animate={{ x: mode === 'plan' ? 0 : 160 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: cfg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 8px ${cfg.color}60`,
              zIndex: 1,
            }}
          >
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 10 }}>
              {mode === 'plan' ? 'P' : 'A'}
            </Typography>
          </motion.div>
        </Box>
      </Box>

      {/* Confirmation dialog for plan → apply */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Box sx={{
              p: 3, borderRadius: 2, border: '2px solid rgba(245,158,11,0.4)', bgcolor: 'rgba(245,158,11,0.04)',
              animation: 'applyPulse 2s ease-in-out infinite',
              '@keyframes applyPulse': {
                '0%, 100%': { borderColor: 'rgba(245,158,11,0.3)' },
                '50%': { borderColor: 'rgba(245,158,11,0.6)' },
              },
            }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F59E0B', mb: 1 }}>
                Switch to Apply Mode?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Apply mode enables live scaling. The next scheduled sleep window will actually scale workloads
                to zero and drain eligible nodes. Make sure your sleep windows and guardrails are configured correctly.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={() => performSwitch('apply')}
                  sx={{ bgcolor: '#F59E0B', color: '#0F0F13', fontWeight: 700, '&:hover': { bgcolor: '#D97706' } }}
                >
                  Switch to Apply
                </Button>
                <Button variant="outlined" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
