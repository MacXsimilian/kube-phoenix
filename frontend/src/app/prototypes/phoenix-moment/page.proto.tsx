'use client'

import { useState, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

type PhoenixState = 'awake' | 'sleeping'

export default function PhoenixMomentPrototype() {
  const router = useRouter()
  const [state, setState] = useState<PhoenixState>('awake')
  const [animating, setAnimating] = useState(false)
  const bandRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)

  const triggerSleep = useCallback(() => {
    if (animating || !bandRef.current || !iconRef.current || !labelRef.current) return
    setAnimating(true)

    const tl = gsap.timeline({
      onComplete: () => { setAnimating(false) },
    })

    tl.to(bandRef.current, {
      background: 'linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(15,15,19,1) 100%)',
      duration: 0.8,
      ease: 'power2.inOut',
    })
    .to(iconRef.current, {
      opacity: 0.3,
      y: 20,
      scale: 0.8,
      rotation: -15,
      duration: 0.6,
      ease: 'power2.in',
    }, '<0.2')
    .to(labelRef.current, {
      opacity: 0,
      y: -10,
      duration: 0.3,
      onComplete: () => setState('sleeping'),
    }, '<')
    .to(labelRef.current, {
      opacity: 1,
      y: 0,
      color: '#a5b4fc',
      duration: 0.4,
    })
    .to(iconRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: 0.5,
      ease: 'power2.out',
    }, '<')

    createParticles('down')
  }, [animating])

  const triggerWake = useCallback(() => {
    if (animating || !bandRef.current || !iconRef.current || !labelRef.current) return
    setAnimating(true)

    const tl = gsap.timeline({
      onComplete: () => { setAnimating(false) },
    })

    tl.to(bandRef.current, {
      boxShadow: '0 0 60px rgba(245,158,11,0.3)',
      duration: 0.4,
    })
    .to(bandRef.current, {
      background: 'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(15,15,19,1) 100%)',
      boxShadow: '0 0 0px rgba(245,158,11,0)',
      duration: 1,
      ease: 'power2.out',
    })
    .to(iconRef.current, {
      opacity: 0,
      y: -15,
      scale: 1.2,
      duration: 0.3,
      ease: 'power2.in',
    }, 0)
    .to(iconRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      ease: 'back.out(1.7)',
      onStart: () => setState('awake'),
    }, 0.4)
    .to(labelRef.current, {
      opacity: 0,
      duration: 0.2,
    }, 0)
    .to(labelRef.current, {
      opacity: 1,
      color: '#86efac',
      duration: 0.4,
    })

    createParticles('up')
  }, [animating])

  function createParticles(direction: 'up' | 'down') {
    if (!particlesRef.current) return
    const container = particlesRef.current
    for (let i = 0; i < 12; i++) {
      const dot = document.createElement('div')
      dot.style.cssText = `position:absolute;width:4px;height:4px;border-radius:50%;background:${direction === 'up' ? '#F59E0B' : '#7C3AED'};left:${20 + Math.random() * 60}%;top:${direction === 'up' ? '80%' : '20%'};opacity:0;`
      container.appendChild(dot)
      gsap.to(dot, {
        y: direction === 'up' ? -(80 + Math.random() * 120) : (80 + Math.random() * 120),
        x: (Math.random() - 0.5) * 60,
        opacity: 0.8,
        duration: 0.4 + Math.random() * 0.4,
        delay: Math.random() * 0.3,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(dot, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => dot.remove(),
          })
        },
      })
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>F18 — Phoenix Moment</Typography>
          <Typography variant="body2" color="text.secondary">
            Cinematic sleep/wake transition with GSAP timeline and particles
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<BedtimeIcon fontSize="small" />}
          onClick={triggerSleep}
          disabled={animating || state === 'sleeping'}
          sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
        >
          Sleep Now
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<WbSunnyIcon fontSize="small" />}
          onClick={triggerWake}
          disabled={animating || state === 'awake'}
          color="success"
        >
          Wake Now
        </Button>
        {animating && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            Transitioning...
          </Typography>
        )}
      </Box>

      {/* Hero band simulation */}
      <Box
        ref={bandRef}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          p: 5,
          background: state === 'awake'
            ? 'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(15,15,19,1) 100%)'
            : 'linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(15,15,19,1) 100%)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          gap: 3,
        }}
      >
        {/* Particle container */}
        <Box ref={particlesRef} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />

        {/* Icon */}
        <Box
          ref={iconRef}
          sx={{
            width: 80,
            height: 80,
            borderRadius: '24px',
            bgcolor: state === 'awake' ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: state === 'awake' ? '#86efac' : '#a5b4fc',
            transition: 'background-color 600ms ease, color 600ms ease',
          }}
        >
          {state === 'awake' ? <WbSunnyIcon sx={{ fontSize: 40 }} /> : <BedtimeIcon sx={{ fontSize: 40 }} />}
        </Box>

        {/* State label */}
        <Typography
          ref={labelRef}
          variant="h3"
          fontWeight={800}
          sx={{
            color: state === 'awake' ? '#86efac' : '#a5b4fc',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {state === 'awake' ? 'Awake' : 'Sleeping'}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          production-sleep-policy
        </Typography>
      </Box>
    </Box>
  )
}
