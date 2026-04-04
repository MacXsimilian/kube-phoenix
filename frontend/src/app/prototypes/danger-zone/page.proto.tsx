'use client'

import { useState, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'

export default function DangerZonePrototype() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [counting, setCounting] = useState(false)
  const [countdownValue, setCountdownValue] = useState(3)
  const [executed, setExecuted] = useState(false)
  const ringRef = useRef<SVGCircleElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const startCountdown = useCallback(() => {
    if (!ringRef.current) return
    setCounting(true)
    setCountdownValue(3)

    const circumference = 2 * Math.PI * 36
    const ring = ringRef.current
    ring.style.strokeDasharray = `${circumference}`
    ring.style.strokeDashoffset = `${circumference}`

    const countObj = { value: 3 }
    gsap.to(countObj, {
      value: 0,
      duration: 3,
      ease: 'linear',
      onUpdate() { setCountdownValue(Math.ceil(countObj.value)) },
    })

    gsap.to(ring, {
      strokeDashoffset: 0,
      duration: 3,
      ease: 'linear',
      onComplete() {
        setCounting(false)
        setExecuted(true)
        setDialogOpen(false)
        if (containerRef.current) {
          gsap.fromTo(containerRef.current,
            { boxShadow: '0 0 0px rgba(239,68,68,0)' },
            { boxShadow: '0 0 40px rgba(239,68,68,0.3)', duration: 0.3, yoyo: true, repeat: 1 },
          )
        }
      },
    })
  }, [])

  const reset = useCallback(() => {
    setDialogOpen(false)
    setCounting(false)
    setCountdownValue(3)
    setExecuted(false)
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F19 — Danger Zone</Typography>
          <Typography variant="body2" color="text.secondary">
            Emergency scale countdown with GSAP arc draw and visceral confirmation
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button variant="outlined" size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={reset}>
          Reset
        </Button>
      </Box>

      {/* Danger zone card */}
      <Box
        ref={containerRef}
        sx={{
          p: 3, borderRadius: 2, border: '1px solid', borderColor: 'rgba(239,68,68,0.3)',
          bgcolor: 'rgba(239,68,68,0.04)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <WarningAmberIcon sx={{ color: '#EF4444' }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: '#EF4444' }}>
            Emergency Scale
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Immediately scale all workloads in all managed namespaces to zero replicas. This bypasses
          all policies, guardrails, and scheduled exceptions. Node drain will be skipped.
        </Typography>

        {executed ? (
          <Box
            sx={{
              p: 2, borderRadius: 1.5, bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              animation: 'dangerFlash 600ms ease-out',
              '@keyframes dangerFlash': { from: { backgroundColor: 'rgba(239,68,68,0.3)' }, to: { backgroundColor: 'rgba(239,68,68,0.1)' } },
            }}
          >
            <Typography variant="body2" sx={{ color: '#F87171', fontWeight: 600 }}>
              Emergency scale executed. All workloads scaled to zero.
            </Typography>
          </Box>
        ) : (
          <Button
            variant="contained"
            color="error"
            onClick={() => setDialogOpen(true)}
            disabled={dialogOpen}
            sx={{
              animation: dialogOpen ? 'none' : 'dangerPulse 2s ease-in-out infinite',
              '@keyframes dangerPulse': {
                '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
                '50%': { boxShadow: '0 0 0 4px rgba(239,68,68,0.2)' },
              },
            }}
          >
            Emergency Scale to Zero
          </Button>
        )}
      </Box>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ marginTop: 24 }}
          >
            <Box
              sx={{
                p: 3, borderRadius: 2, border: '2px solid rgba(239,68,68,0.5)',
                bgcolor: 'background.paper',
                boxShadow: '0 0 30px rgba(239,68,68,0.1)',
                animation: 'dialogPulse 3s ease-in-out infinite',
                '@keyframes dialogPulse': {
                  '0%, 100%': { borderColor: 'rgba(239,68,68,0.3)' },
                  '50%': { borderColor: 'rgba(239,68,68,0.6)' },
                },
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: '#EF4444' }}>
                Confirm Emergency Scale
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This will scale ALL managed workloads to zero. This action cannot be automatically reversed.
                You will need to manually wake each policy to restore workloads.
              </Typography>

              {/* Countdown ring */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 3 }}>
                <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                  <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
                    <circle
                      ref={ringRef}
                      cx="40" cy="40" r="36"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <Typography
                    sx={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, fontWeight: 800, color: counting ? '#EF4444' : 'text.secondary',
                      fontFamily: 'monospace',
                    }}
                  >
                    {counting ? countdownValue : '3'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={startCountdown}
                  disabled={counting}
                  fullWidth
                >
                  {counting ? 'Executing...' : 'Hold to Confirm'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setDialogOpen(false)}
                  disabled={counting}
                  fullWidth
                >
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
