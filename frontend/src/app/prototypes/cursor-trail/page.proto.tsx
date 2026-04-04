'use client';

// PROTOTYPE: Cursor Cluster Trail
// DEPS: framer-motion gsap
// LIBS: Canvas 2D, Framer Motion
// DATA: Namespace zones with health status
// DESCRIPTION: Custom cursor trail that changes based on hovered namespace health

import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';

interface NamespaceZone {
  name: string;
  status: 'healthy' | 'sleeping' | 'degraded' | 'warning' | 'critical';
  color: string;
  trailColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  createdAt: number;
  behavior: 'float' | 'sink';
}

const ZONES: NamespaceZone[] = [
  { name: 'production', status: 'healthy', color: '#1b5e20', trailColor: '#66bb6a', x: 60, y: 80, width: 400, height: 260 },
  { name: 'staging', status: 'sleeping', color: '#1a237e', trailColor: '#7986cb', x: 500, y: 80, width: 400, height: 260 },
  { name: 'dev-team-alpha', status: 'warning', color: '#e65100', trailColor: '#ffa726', x: 60, y: 380, width: 280, height: 260 },
  { name: 'monitoring', status: 'degraded', color: '#b71c1c', trailColor: '#ef5350', x: 380, y: 380, width: 280, height: 260 },
  { name: 'batch-jobs', status: 'sleeping', color: '#4a148c', trailColor: '#ab47bc', x: 700, y: 380, width: 260, height: 260 },
];

const TRAIL_LIFETIME_MS = 800;
const MAX_PARTICLES = 200;

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  sleeping: 'Sleeping',
  degraded: 'Degraded',
  warning: 'Warning',
  critical: 'Critical',
};

function findHoveredZone(mx: number, my: number, container: DOMRect): NamespaceZone | null {
  const relX = mx - container.left;
  const relY = my - container.top;
  for (const zone of ZONES) {
    if (relX >= zone.x && relX <= zone.x + zone.width && relY >= zone.y && relY <= zone.y + zone.height) {
      return zone;
    }
  }
  return null;
}

function createParticle(x: number, y: number, zone: NamespaceZone | null): TrailParticle {
  const isSleeping = zone?.status === 'sleeping';
  const color = zone?.trailColor ?? '#90a4ae';
  const baseRadius = isSleeping ? 4 + Math.random() * 3 : 2 + Math.random() * 3;

  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 1.2,
    vy: isSleeping ? 0.3 + Math.random() * 0.5 : -(0.5 + Math.random() * 1.0),
    radius: baseRadius,
    color,
    alpha: 1,
    createdAt: performance.now(),
    behavior: isSleeping ? 'sink' : 'float',
  };
}

export default function CursorTrailPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<TrailParticle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const [hoveredZone, setHoveredZone] = useState<NamespaceZone | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const zone = findHoveredZone(e.clientX, e.clientY, rect);
    setHoveredZone(zone);

    const now = performance.now();
    if (now - lastSpawnRef.current < 16) return;
    lastSpawnRef.current = now;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const particle = createParticle(canvasX, canvasY, zone);
    particlesRef.current.push(particle);

    if (particlesRef.current.length > MAX_PARTICLES) {
      particlesRef.current = particlesRef.current.slice(-MAX_PARTICLES);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => {
        const age = now - p.createdAt;
        return age < TRAIL_LIFETIME_MS;
      });

      for (const p of particlesRef.current) {
        const age = now - p.createdAt;
        const progress = age / TRAIL_LIFETIME_MS;
        p.alpha = 1 - progress;
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * 0.8;
        ctx.fill();

        if (p.behavior === 'sink') {
          ctx.globalAlpha = p.alpha * 0.3;
          ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        bgcolor: '#0a0a0f',
        overflow: 'hidden',
        cursor: 'none',
      }}
    >
      <Typography
        variant="h4"
        sx={{ color: '#fff', textAlign: 'center', pt: 2, fontWeight: 700, userSelect: 'none' }}
      >
        Cursor Cluster Trail
      </Typography>

      {ZONES.map((zone) => (
        <Box
          key={zone.name}
          sx={{
            position: 'absolute',
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
            bgcolor: zone.color,
            borderRadius: 2,
            border: '2px solid',
            borderColor: zone.trailColor,
            opacity: 0.6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            userSelect: 'none',
          }}
        >
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            {zone.name}
          </Typography>
          <Chip
            label={STATUS_LABELS[zone.status]}
            size="small"
            sx={{
              bgcolor: zone.trailColor,
              color: '#000',
              fontWeight: 600,
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            {zone.status === 'sleeping' ? 'Trail: moons sinking ↓' : 'Trail: embers floating ↑'}
          </Typography>
        </Box>
      ))}

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

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
            K12 — Cursor Cluster Trail
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Particles: {particlesRef.current.length}
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Hovered: {hoveredZone?.name ?? 'none'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Status: {hoveredZone ? STATUS_LABELS[hoveredZone.status] : '—'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Behavior: {hoveredZone?.status === 'sleeping' ? 'Gravity (moons)' : 'Float (embers)'}
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
}
