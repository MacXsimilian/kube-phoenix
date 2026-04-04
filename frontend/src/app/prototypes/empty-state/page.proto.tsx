'use client';

// PROTOTYPE: Smart Empty State
// DEPS: framer-motion gsap
// LIBS: SVG, GSAP, Framer Motion, CSS
// DATA: Empty state scenarios
// DESCRIPTION: Three animated empty states — phoenix egg, hourglass, radar sweep

import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

function PhoenixEggState({ triggerReset }: { triggerReset: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const crackRefs = useRef<(SVGPathElement | null)[]>([]);
  const glowRef = useRef<SVGCircleElement>(null);
  const sparkleContainerRef = useRef<HTMLDivElement>(null);
  const [hatched, setHatched] = useState(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const setCrackRef = useCallback((index: number) => (el: SVGPathElement | null) => {
    crackRefs.current[index] = el;
  }, []);

  useEffect(() => {
    setHatched(false);
    const cracks = crackRefs.current.filter(Boolean) as SVGPathElement[];
    const glow = glowRef.current;

    cracks.forEach((crack) => {
      const length = crack.getTotalLength();
      gsap.set(crack, { strokeDasharray: length, strokeDashoffset: length });
    });

    if (glow) {
      gsap.set(glow, { opacity: 0.3 });
    }

    const tl = gsap.timeline();
    timelineRef.current = tl;

    tl.to(glow, { opacity: 0.8, duration: 1.5, repeat: 3, yoyo: true, ease: 'sine.inOut' });

    cracks.forEach((crack, i) => {
      const length = crack.getTotalLength();
      tl.to(crack, {
        strokeDashoffset: 0,
        duration: 0.8,
        ease: 'power2.inOut',
      }, 1 + i * 0.6);
    });

    tl.call(() => setHatched(true), [], '+=0.3');

    return () => {
      tl.kill();
    };
  }, [triggerReset]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="overline" sx={{ color: '#78909c', letterSpacing: 2 }}>
        No Policies Yet
      </Typography>

      <Box sx={{ position: 'relative', width: 160, height: 200 }}>
        <svg ref={svgRef} viewBox="0 0 160 200" width="160" height="200">
          <defs>
            <radialGradient id="eggGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff6f00" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ff6f00" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle ref={glowRef} cx="80" cy="110" r="60" fill="url(#eggGlow)" />

          <ellipse cx="80" cy="110" rx="45" ry="60" fill="#37474f" stroke="#546e7a" strokeWidth="2" />

          <path
            ref={setCrackRef(0)}
            d="M80 50 L75 70 L85 80 L78 95"
            fill="none"
            stroke="#ffab00"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            ref={setCrackRef(1)}
            d="M65 75 L72 85 L60 100"
            fill="none"
            stroke="#ffab00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            ref={setCrackRef(2)}
            d="M95 80 L88 95 L98 110"
            fill="none"
            stroke="#ffab00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <AnimatePresence>
          {hatched && (
            <Box ref={sparkleContainerRef} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 1,
                    scale: 0,
                    x: 80,
                    y: 100,
                  }}
                  animate={{
                    opacity: 0,
                    scale: 1.5,
                    x: 80 + Math.cos((i / 12) * Math.PI * 2) * 60,
                    y: 100 + Math.sin((i / 12) * Math.PI * 2) * 60,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#ffab00',
                  }}
                />
              ))}
            </Box>
          )}
        </AnimatePresence>
      </Box>

      <motion.div
        animate={hatched ? {} : { scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <Button
          variant="contained"
          sx={{
            bgcolor: '#ff6f00',
            '&:hover': { bgcolor: '#e65100' },
            boxShadow: hatched ? '0 0 20px rgba(255,111,0,0.6)' : '0 0 10px rgba(255,111,0,0.3)',
            transition: 'box-shadow 0.3s',
          }}
        >
          Create First Policy
        </Button>
      </motion.div>
    </Box>
  );
}

function HourglassState({ triggerReset }: { triggerReset: number }) {
  const sandParticlesRef = useRef<(SVGCircleElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const setSandRef = useCallback((index: number) => (el: SVGCircleElement | null) => {
    sandParticlesRef.current[index] = el;
  }, []);

  useEffect(() => {
    const particles = sandParticlesRef.current.filter(Boolean) as SVGCircleElement[];

    const tl = gsap.timeline({ repeat: -1 });
    timelineRef.current = tl;

    particles.forEach((p, i) => {
      gsap.set(p, { opacity: 0 });
      tl.to(p, {
        attr: { cy: 140 + Math.random() * 15 },
        opacity: 1,
        duration: 1.2,
        ease: 'power1.in',
      }, i * 0.3)
      .to(p, { opacity: 0, duration: 0.3 }, i * 0.3 + 1.2);
    });

    return () => {
      tl.kill();
    };
  }, [triggerReset]);

  const sandParticlePositions = Array.from({ length: 8 }).map((_, i) => ({
    cx: 75 + (i % 4) * 4 - 6,
    startCy: 70 + Math.floor(i / 4) * 5,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="overline" sx={{ color: '#78909c', letterSpacing: 2 }}>
        No Executions
      </Typography>

      <svg viewBox="0 0 160 200" width="160" height="200">
        <rect x="55" y="40" width="50" height="5" rx="2" fill="#546e7a" />
        <rect x="55" y="155" width="50" height="5" rx="2" fill="#546e7a" />

        <path
          d="M60 45 L60 80 Q80 105 80 100 Q80 105 100 80 L100 45 Z"
          fill="none"
          stroke="#78909c"
          strokeWidth="2"
        />
        <path
          d="M60 155 L60 120 Q80 95 80 100 Q80 95 100 120 L100 155 Z"
          fill="none"
          stroke="#78909c"
          strokeWidth="2"
        />

        <line x1="80" y1="95" x2="80" y2="105" stroke="#ffab00" strokeWidth="1.5" opacity="0.6" />

        {sandParticlePositions.map((pos, i) => (
          <circle
            key={i}
            ref={setSandRef(i)}
            cx={pos.cx}
            cy={pos.startCy}
            r="1.8"
            fill="#ffab00"
          />
        ))}

        <path
          d="M65 145 Q80 135 95 145 L95 155 L65 155 Z"
          fill="#ffab00"
          opacity="0.4"
        />
      </svg>

      <Typography variant="body2" sx={{ color: '#90a4ae', fontStyle: 'italic' }}>
        Waiting for first sleep...
      </Typography>
    </Box>
  );
}

function RadarSweepState() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="overline" sx={{ color: '#78909c', letterSpacing: 2 }}>
        Cluster Connected, No Data
      </Typography>

      <Box
        sx={{
          position: 'relative',
          width: 160,
          height: 160,
        }}
      >
        <Box
          sx={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            border: '2px solid #37474f',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: 'rgba(0,77,64,0.15)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 4,
              height: 4,
              bgcolor: '#00e676',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,230,118,0.3) 30deg, transparent 60deg)',
              animation: 'radarSpin 2.5s linear infinite',
              '@keyframes radarSpin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' },
              },
            }}
          />

          {[40, 60, 80].map((r, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                border: '1px solid rgba(0,230,118,0.15)',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: '#90a4ae', fontStyle: 'italic' }}>
        Scanning cluster...
      </Typography>
    </Box>
  );
}

export default function EmptyStatePrototype() {
  const [resetCounter, setResetCounter] = useState(0);

  const handleReset = useCallback(() => {
    setResetCounter((c) => c + 1);
  }, []);

  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        bgcolor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pb: 10,
      }}
    >
      <Typography
        variant="h4"
        sx={{ color: '#fff', textAlign: 'center', pt: 4, mb: 6, fontWeight: 700 }}
      >
        Smart Empty States
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'center',
          px: 4,
        }}
      >
        <Box
          sx={{
            bgcolor: '#161b22',
            borderRadius: 3,
            p: 4,
            minWidth: 280,
            border: '1px solid #30363d',
          }}
        >
          <PhoenixEggState triggerReset={resetCounter} />
        </Box>

        <Box
          sx={{
            bgcolor: '#161b22',
            borderRadius: 3,
            p: 4,
            minWidth: 280,
            border: '1px solid #30363d',
          }}
        >
          <HourglassState triggerReset={resetCounter} />
        </Box>

        <Box
          sx={{
            bgcolor: '#161b22',
            borderRadius: 3,
            p: 4,
            minWidth: 280,
            border: '1px solid #30363d',
          }}
        >
          <RadarSweepState />
        </Box>
      </Box>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            bgcolor: 'rgba(0,0,0,0.85)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Typography variant="caption" sx={{ color: '#90a4ae', fontWeight: 600 }}>
            K13 — Smart Empty State
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleReset}
            sx={{
              color: '#90a4ae',
              borderColor: '#455a64',
              textTransform: 'none',
              fontSize: '0.7rem',
            }}
          >
            Reset Animations
          </Button>
        </Box>
      </motion.div>
    </Box>
  );
}
