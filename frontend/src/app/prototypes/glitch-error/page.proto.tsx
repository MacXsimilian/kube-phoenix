'use client'

// PROTOTYPE: Glitch Error State
// DEPS: framer-motion gsap
// LIBS: GSAP, Framer Motion, CSS
// DATA: Policy card with error state
// DESCRIPTION: CSS glitch effect on policy cards when execution fails

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'

interface PolicyCard {
  name: string
  status: 'healthy' | 'error' | 'sleeping'
  namespace: string
  lastRun: string
  replicas: string
}

const POLICIES: PolicyCard[] = [
  {
    name: 'Non-production Sleep',
    status: 'healthy',
    namespace: 'dev / staging',
    lastRun: '2 min ago',
    replicas: '12 / 12',
  },
  {
    name: 'ML Training Shutdown',
    status: 'healthy',
    namespace: 'ml-training',
    lastRun: '5 min ago',
    replicas: '8 / 8',
  },
  {
    name: 'Weekend Full Sleep',
    status: 'sleeping',
    namespace: 'all-nonprod',
    lastRun: '1 hr ago',
    replicas: '0 / 24',
  },
]

const STATUS_COLORS = {
  healthy: '#22C55E',
  error: '#EF4444',
  sleeping: '#3B82F6',
} as const

const STATUS_ICONS = {
  healthy: <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />,
  error: <ErrorOutlineIcon sx={{ fontSize: 18 }} />,
  sleeping: <NightsStayIcon sx={{ fontSize: 18 }} />,
} as const

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789ABCDEFabcdef'
const ERROR_MESSAGE = 'EXECUTION FAILED'
const GLITCH_DURATION_MS = 2000

function getRandomChar(): string {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
}

function scrambleText(target: string, progress: number): string {
  return target
    .split('')
    .map((char, i) => {
      const threshold = (i / target.length) * 0.8
      return progress > threshold ? char : getRandomChar()
    })
    .join('')
}

export default function GlitchErrorPrototype() {
  const router = useRouter()
  const [policies, setPolicies] = useState<PolicyCard[]>(POLICIES)
  const [glitching, setGlitching] = useState(false)
  const [showErrorBadge, setShowErrorBadge] = useState(false)
  const [scrambledText, setScrambledText] = useState('')

  const glitchCardRef = useRef<HTMLDivElement>(null)
  const errorBadgeRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const scrambleRafRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (timelineRef.current) timelineRef.current.kill()
      if (scrambleRafRef.current) cancelAnimationFrame(scrambleRafRef.current)
    }
  }, [])

  const triggerGlitch = useCallback(() => {
    if (glitching) return

    setGlitching(true)
    setShowErrorBadge(false)
    setScrambledText('')

    setPolicies((prev) =>
      prev.map((p, i) => (i === 1 ? { ...p, status: 'error' as const } : p)),
    )

    const startTime = performance.now()

    function animateScramble() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / GLITCH_DURATION_MS, 1)
      setScrambledText(scrambleText(ERROR_MESSAGE, progress))

      if (progress < 1) {
        scrambleRafRef.current = requestAnimationFrame(animateScramble)
      } else {
        setScrambledText(ERROR_MESSAGE)
      }
    }

    scrambleRafRef.current = requestAnimationFrame(animateScramble)

    if (timelineRef.current) timelineRef.current.kill()

    const tl = gsap.timeline({
      onComplete() {
        setGlitching(false)
        setShowErrorBadge(true)
      },
    })
    timelineRef.current = tl

    if (glitchCardRef.current) {
      tl.to(glitchCardRef.current, {
        x: -4,
        duration: 0.05,
        repeat: 8,
        yoyo: true,
        ease: 'none',
      })
        .to(
          glitchCardRef.current,
          {
            x: 6,
            duration: 0.03,
            repeat: 6,
            yoyo: true,
            ease: 'steps(2)',
          },
          0.4,
        )
        .to(
          glitchCardRef.current,
          {
            x: -2,
            duration: 0.04,
            repeat: 4,
            yoyo: true,
            ease: 'none',
          },
          1.0,
        )
        .to(glitchCardRef.current, {
          x: 0,
          duration: 0.2,
          ease: 'power2.out',
        })
    }

    tl.add(() => {
      setShowErrorBadge(true)
    }, GLITCH_DURATION_MS / 1000)
  }, [glitching])

  const clearError = useCallback(() => {
    if (timelineRef.current) timelineRef.current.kill()
    if (scrambleRafRef.current) cancelAnimationFrame(scrambleRafRef.current)

    setGlitching(false)
    setShowErrorBadge(false)
    setScrambledText('')
    setPolicies(POLICIES)
  }, [])

  useEffect(() => {
    if (!showErrorBadge || !errorBadgeRef.current) return

    gsap.fromTo(
      errorBadgeRef.current,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'elastic.out(1.2, 0.4)',
      },
    )
  }, [showErrorBadge])

  const isErrorCard = (index: number): boolean =>
    index === 1 && policies[1].status === 'error'

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2, pb: 12 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            K5 — Glitch Error State
          </Typography>
          <Typography variant="body2" color="text.secondary">
            CSS glitch effect on policy cards when execution fails
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2.5,
        }}
      >
        {policies.map((policy, index) => {
          const isError = isErrorCard(index)
          const color = STATUS_COLORS[policy.status]

          return (
            <Box
              key={policy.name}
              ref={index === 1 ? glitchCardRef : undefined}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: isError
                  ? 'rgba(239,68,68,0.5)'
                  : `${color}33`,
                bgcolor: isError
                  ? 'rgba(239,68,68,0.04)'
                  : 'rgba(255,255,255,0.02)',
                position: 'relative',
                overflow: 'hidden',
                transition: glitching ? 'none' : 'border-color 0.3s, background-color 0.3s',
                ...(glitching && index === 1
                  ? {
                      animation: 'glitchFlicker 100ms steps(2, end) infinite',
                      '@keyframes glitchFlicker': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.85 },
                        '100%': { opacity: 1 },
                      },
                    }
                  : {}),
              }}
            >
              {glitching && index === 1 && (
                <>
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 2,
                      animation:
                        'scanLines 80ms steps(4, end) infinite',
                      '@keyframes scanLines': {
                        '0%': {
                          clipPath:
                            'polygon(0 0, 100% 0, 100% 5%, 0 5%)',
                        },
                        '25%': {
                          clipPath:
                            'polygon(0 30%, 100% 30%, 100% 35%, 0 35%)',
                        },
                        '50%': {
                          clipPath:
                            'polygon(0 60%, 100% 60%, 100% 65%, 0 65%)',
                        },
                        '75%': {
                          clipPath:
                            'polygon(0 80%, 100% 80%, 100% 88%, 0 88%)',
                        },
                        '100%': {
                          clipPath:
                            'polygon(0 45%, 100% 45%, 100% 50%, 0 50%)',
                        },
                      },
                      bgcolor: 'rgba(239,68,68,0.15)',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 1,
                      background:
                        'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.03) 2px, rgba(239,68,68,0.03) 4px)',
                    }}
                  />
                </>
              )}

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color }}>{STATUS_ICONS[policy.status]}</Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      color: isError ? '#EF4444' : 'text.primary',
                      ...(glitching && index === 1
                        ? {
                            textShadow:
                              '-2px 0 #3B82F6, 2px 0 #EF4444, 0 0 8px rgba(239,68,68,0.5)',
                            animation:
                              'glitchText 150ms steps(3, end) infinite alternate',
                            '@keyframes glitchText': {
                              '0%': {
                                textShadow:
                                  '-2px 0 #3B82F6, 2px 0 #EF4444',
                              },
                              '33%': {
                                textShadow:
                                  '2px 0 #3B82F6, -2px 0 #EF4444',
                              },
                              '66%': {
                                textShadow:
                                  '-1px 1px #3B82F6, 1px -1px #EF4444',
                              },
                              '100%': {
                                textShadow:
                                  '1px 0 #3B82F6, -1px 0 #EF4444, 0 0 12px rgba(239,68,68,0.8)',
                              },
                            },
                          }
                        : {}),
                    }}
                  >
                    {policy.name}
                  </Typography>
                </Box>
                <Chip
                  label={policy.status.toUpperCase()}
                  size="small"
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    height: 22,
                    bgcolor: `${color}22`,
                    color,
                    border: `1px solid ${color}44`,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Namespace
                  </Typography>
                  <Typography variant="caption" fontWeight={600}>
                    {policy.namespace}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Last Run
                  </Typography>
                  <Typography variant="caption" fontWeight={600}>
                    {policy.lastRun}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Replicas
                  </Typography>
                  <Typography variant="caption" fontWeight={600}>
                    {policy.replicas}
                  </Typography>
                </Box>
              </Box>

              {glitching && index === 1 && (
                <Box
                  sx={{
                    mt: 2,
                    pt: 1.5,
                    borderTop: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#EF4444',
                      letterSpacing: '0.1em',
                      textShadow:
                        '-1px 0 #3B82F6, 1px 0 #EF4444',
                    }}
                  >
                    {scrambledText || '\u00A0'}
                  </Typography>
                </Box>
              )}

              <AnimatePresence>
                {showErrorBadge && isError && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(239,68,68,0.3)' }}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                    >
                      <Box
                        ref={errorBadgeRef}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 1,
                          bgcolor: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.3)',
                        }}
                      >
                        <ErrorOutlineIcon
                          sx={{ fontSize: 14, color: '#EF4444' }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: '#EF4444',
                            fontFamily: 'monospace',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {ERROR_MESSAGE}
                        </Typography>
                      </Box>
                    </motion.div>
                  </Box>
                )}
              </AnimatePresence>
            </Box>
          )
        })}
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          py: 1.5,
          px: 3,
          bgcolor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.5)', mr: 2, fontFamily: 'monospace' }}
        >
          K5 GLITCH ERROR
        </Typography>
        <Button
          variant="contained"
          size="small"
          color="error"
          onClick={triggerGlitch}
          disabled={glitching}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12 }}
        >
          Trigger Error
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={clearError}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 12,
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Clear Error
        </Button>
      </Box>
    </Box>
  )
}
