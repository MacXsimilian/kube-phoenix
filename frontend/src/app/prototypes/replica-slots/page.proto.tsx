'use client'

// PROTOTYPE: Replica Counter Slot Machine
// DEPS: framer-motion gsap
// LIBS: GSAP, Framer Motion, CSS 3D Transforms
// DATA: Workload replica counts
// DESCRIPTION: Casino slot machine reels for per-workload replica counters

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CasinoIcon from '@mui/icons-material/Casino'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────

interface Workload {
  name: string
  replicas: number
  maxReplicas: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const FACE_ANGLE = 360 / DIGITS.length
const REEL_RADIUS = 32

const INITIAL_WORKLOADS: Workload[] = [
  { name: 'api-gateway', replicas: 8, maxReplicas: 12 },
  { name: 'checkout-service', replicas: 4, maxReplicas: 8 },
  { name: 'payment-processor', replicas: 3, maxReplicas: 6 },
  { name: 'staging-api', replicas: 6, maxReplicas: 10 },
  { name: 'admin-portal', replicas: 3, maxReplicas: 5 },
  { name: 'dev-api', replicas: 2, maxReplicas: 4 },
]

const COLOR_GREEN = '#22C55E'
const COLOR_RED = '#EF4444'
const COLOR_PURPLE = '#7C3AED'
const COLOR_EMBER = '#FBBF24'

// ── Helpers ────────────────────────────────────────────────────────────────

function splitDigits(value: number): number[] {
  const tens = Math.floor(value / 10)
  const ones = value % 10
  return [tens, ones]
}

// ── Slot Reel Component ────────────────────────────────────────────────────

function SlotReel({
  targetDigit,
  direction,
  reelIndex,
  glowColor,
}: {
  targetDigit: number
  direction: 'up' | 'down'
  reelIndex: number
  glowColor: string
}) {
  const cylinderRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const currentRotation = useRef(0)
  const prevDigit = useRef(targetDigit)

  useEffect(() => {
    if (prevDigit.current === targetDigit) return
    prevDigit.current = targetDigit

    const cylinder = cylinderRef.current
    if (!cylinder) return

    if (timelineRef.current) {
      timelineRef.current.kill()
    }

    const targetAngle = -targetDigit * FACE_ANGLE
    const spinDirection = direction === 'up' ? -1 : 1
    const fullSpins = spinDirection * 360 * (2 + reelIndex * 0.5)
    const finalAngle = targetAngle + fullSpins

    const tl = gsap.timeline()
    timelineRef.current = tl

    tl.to(cylinder, {
      rotateX: currentRotation.current + fullSpins * 0.6,
      duration: 0.3 + reelIndex * 0.08,
      ease: 'power2.in',
    })

    tl.to(cylinder, {
      rotateX: finalAngle,
      duration: 0.8 + reelIndex * 0.12,
      ease: 'elastic.out(1, 0.4)',
      onComplete: () => {
        currentRotation.current = finalAngle
      },
    })

    return () => {
      tl.kill()
    }
  }, [targetDigit, direction, reelIndex])

  useEffect(() => {
    const cylinder = cylinderRef.current
    if (!cylinder) return
    const initialAngle = -targetDigit * FACE_ANGLE
    gsap.set(cylinder, { rotateX: initialAngle })
    currentRotation.current = initialAngle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill()
      }
    }
  }, [])

  return (
    <Box
      sx={{
        width: 36,
        height: 44,
        perspective: '200px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'rgba(0,0,0,0.4)',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: `inset 0 0 12px ${glowColor}20, 0 0 8px ${glowColor}10`,
        transition: 'box-shadow 300ms ease',
      }}
    >
      <Box
        ref={cylinderRef}
        sx={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          transformStyle: 'preserve-3d',
        }}
      >
        {DIGITS.map((digit) => {
          const angle = digit * FACE_ANGLE
          return (
            <Box
              key={digit}
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backfaceVisibility: 'hidden',
                transform: `rotateX(${angle}deg) translateZ(${REEL_RADIUS}px)`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#E2E8F0',
                  textShadow: `0 0 6px ${glowColor}60`,
                }}
              >
                {digit}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: 'linear-gradient(to bottom, rgba(15,15,19,0.9), transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30%',
          background: 'linear-gradient(to top, rgba(15,15,19,0.9), transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </Box>
  )
}

// ── Flash Overlay ──────────────────────────────────────────────────────────

function FlashOverlay({ color, trigger }: { color: string; trigger: number }) {
  return (
    <AnimatePresence>
      {trigger > 0 && (
        <motion.div
          key={trigger}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            backgroundColor: color,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
    </AnimatePresence>
  )
}

// ── Slot Machine Card ──────────────────────────────────────────────────────

function SlotMachineCard({ workload }: { workload: Workload }) {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const [flashTrigger, setFlashTrigger] = useState(0)
  const prevReplicas = useRef(workload.replicas)
  const digits = splitDigits(workload.replicas)
  const isZero = workload.replicas === 0
  const glowColor = isZero ? COLOR_RED : COLOR_GREEN

  useEffect(() => {
    if (prevReplicas.current !== workload.replicas) {
      const newDirection = workload.replicas > prevReplicas.current ? 'up' : 'down'
      setDirection(newDirection)
      setFlashTrigger((prev) => prev + 1)
      prevReplicas.current = workload.replicas
    }
  }, [workload.replicas])

  const flashColor = direction === 'up' ? `${COLOR_GREEN}30` : `${COLOR_RED}30`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box
        sx={{
          position: 'relative',
          p: 2.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: isZero ? 'error.main' : 'divider',
          overflow: 'hidden',
          transition: 'border-color 400ms ease, box-shadow 400ms ease',
          boxShadow: isZero
            ? `0 0 20px ${COLOR_RED}15, inset 0 0 20px ${COLOR_RED}08`
            : `0 2px 8px rgba(0,0,0,0.2)`,
        }}
      >
        <FlashOverlay color={flashColor} trigger={flashTrigger} />

        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'text.secondary',
            letterSpacing: 1,
            textTransform: 'uppercase',
            mb: 1.5,
            display: 'block',
          }}
        >
          {workload.name}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            my: 2,
          }}
        >
          <SlotReel
            targetDigit={digits[0]}
            direction={direction}
            reelIndex={0}
            glowColor={glowColor}
          />
          <SlotReel
            targetDigit={digits[1]}
            direction={direction}
            reelIndex={1}
            glowColor={glowColor}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: 10,
              color: isZero ? 'error.main' : 'success.main',
              fontWeight: 600,
            }}
          >
            {isZero ? 'SLEEPING' : `${workload.replicas} REPLICAS`}
          </Typography>

          <Box
            sx={{
              width: 48,
              height: 3,
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 1,
                bgcolor: isZero ? COLOR_RED : COLOR_GREEN,
                width: `${(workload.replicas / workload.maxReplicas) * 100}%`,
                transition:
                  'width 500ms cubic-bezier(0.22,1,0.36,1), background-color 300ms ease',
              }}
            />
          </Box>
        </Box>
      </Box>
    </motion.div>
  )
}

// ── Main Prototype ─────────────────────────────────────────────────────────

export default function ReplicaSlotsPrototype() {
  const router = useRouter()
  const [workloads, setWorkloads] = useState<Workload[]>(INITIAL_WORKLOADS)

  const updateReplicas = useCallback(
    (name: string, delta: number) => {
      setWorkloads((prev) =>
        prev.map((w) => {
          if (w.name !== name) return w
          const next = Math.max(0, Math.min(w.maxReplicas, w.replicas + delta))
          return { ...w, replicas: next }
        }),
      )
    },
    [],
  )

  const sleepAll = useCallback(() => {
    setWorkloads((prev) => prev.map((w) => ({ ...w, replicas: 0 })))
  }, [])

  const wakeAll = useCallback(() => {
    setWorkloads((prev) =>
      prev.map((w, i) => {
        const restored = INITIAL_WORKLOADS[i]?.maxReplicas
          ? INITIAL_WORKLOADS[i].replicas
          : w.maxReplicas
        return { ...w, replicas: restored }
      }),
    )
  }, [])

  const totalReplicas = workloads.reduce((sum, w) => sum + w.replicas, 0)
  const totalMax = workloads.reduce((sum, w) => sum + w.maxReplicas, 0)
  const allSleeping = totalReplicas === 0
  const allAwake = workloads.every(
    (w, i) => w.replicas === INITIAL_WORKLOADS[i].replicas,
  )

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton
          onClick={() => router.push('/prototypes/')}
          size="small"
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <CasinoIcon sx={{ color: COLOR_EMBER, fontSize: 28 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>
            K4 — Replica Counter Slot Machine
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Casino slot machine reels for per-workload replica counters with CSS
            3D cylinder effect
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: allSleeping ? COLOR_RED : COLOR_GREEN,
          }}
        >
          {totalReplicas}/{totalMax} total
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          size="small"
          startIcon={<BedtimeIcon fontSize="small" />}
          onClick={sleepAll}
          disabled={allSleeping}
          sx={{
            bgcolor: COLOR_PURPLE,
            '&:hover': { bgcolor: '#6D28D9' },
            textTransform: 'none',
            fontSize: 12,
          }}
        >
          Sleep All
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<WbSunnyIcon fontSize="small" />}
          onClick={wakeAll}
          disabled={allAwake}
          color="success"
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          Wake All
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 2,
          mb: 10,
        }}
      >
        {workloads.map((w) => (
          <SlotMachineCard key={w.name} workload={w} />
        ))}
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'rgba(15,15,19,0.95)',
          borderTop: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(12px)',
          px: 2,
          py: 1.5,
        }}
      >
        <Box
          sx={{
            maxWidth: 900,
            mx: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: COLOR_EMBER,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 1,
              mr: 1,
            }}
          >
            DEV TOOLBAR
          </Typography>

          {workloads.map((w) => (
            <Box
              key={w.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 9,
                  color: 'text.secondary',
                  maxWidth: 64,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => updateReplicas(w.name, -1)}
                disabled={w.replicas === 0}
                sx={{ p: 0.25 }}
              >
                <RemoveIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 16,
                  textAlign: 'center',
                  color: w.replicas === 0 ? COLOR_RED : COLOR_GREEN,
                }}
              >
                {w.replicas}
              </Typography>
              <IconButton
                size="small"
                onClick={() => updateReplicas(w.name, 1)}
                disabled={w.replicas >= w.maxReplicas}
                sx={{ p: 0.25 }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}

          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={sleepAll}
              disabled={allSleeping}
              sx={{
                fontSize: 10,
                textTransform: 'none',
                color: COLOR_PURPLE,
                minWidth: 0,
                px: 1,
              }}
            >
              Sleep All
            </Button>
            <Button
              size="small"
              onClick={wakeAll}
              disabled={allAwake}
              sx={{
                fontSize: 10,
                textTransform: 'none',
                color: COLOR_GREEN,
                minWidth: 0,
                px: 1,
              }}
            >
              Wake All
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
