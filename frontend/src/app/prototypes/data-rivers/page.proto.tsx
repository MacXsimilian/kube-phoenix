'use client';

// PROTOTYPE: Data Flow Rivers
// DEPS: framer-motion gsap
// LIBS: SVG, Canvas 2D, GSAP, Framer Motion
// DATA: Service-to-service traffic
// DESCRIPTION: Service traffic as animated rivers with flowing particles

import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Typography, Button, Slider } from '@mui/material';
import { motion } from 'framer-motion';
import gsap from 'gsap';

interface ServiceNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface ServiceLink {
  source: string;
  target: string;
  rps: number;
  latencyMs: number;
  path: string;
}

interface RiverParticle {
  linkIndex: number;
  progress: number;
  speed: number;
  color: string;
  radius: number;
}

const SERVICES: ServiceNode[] = [
  { id: 'api-gateway', label: 'api-gateway', x: 100, y: 260 },
  { id: 'user-auth', label: 'user-auth', x: 420, y: 100 },
  { id: 'checkout-service', label: 'checkout-service', x: 420, y: 260 },
  { id: 'payment-processor', label: 'payment-processor', x: 740, y: 260 },
  { id: 'kafka-consumer', label: 'kafka-consumer', x: 420, y: 420 },
  { id: 'spark-driver', label: 'spark-driver', x: 740, y: 420 },
];

const LINKS: ServiceLink[] = [
  { source: 'api-gateway', target: 'user-auth', rps: 800, latencyMs: 45, path: '' },
  { source: 'api-gateway', target: 'checkout-service', rps: 400, latencyMs: 67, path: '' },
  { source: 'checkout-service', target: 'payment-processor', rps: 350, latencyMs: 120, path: '' },
  { source: 'api-gateway', target: 'kafka-consumer', rps: 200, latencyMs: 23, path: '' },
  { source: 'kafka-consumer', target: 'spark-driver', rps: 150, latencyMs: 340, path: '' },
];

const SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));
const BOX_W = 160;
const BOX_H = 50;

function buildCurvePath(sourceId: string, targetId: string): string {
  const src = SERVICE_MAP.get(sourceId);
  const tgt = SERVICE_MAP.get(targetId);
  if (!src || !tgt) return '';

  const sx = src.x + BOX_W;
  const sy = src.y + BOX_H / 2;
  const tx = tgt.x;
  const ty = tgt.y + BOX_H / 2;
  const cpx = (sx + tx) / 2;

  return `M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ty}, ${tx} ${ty}`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return '#66bb6a';
  if (ms <= 500) return '#ffa726';
  return '#ef5350';
}

function strokeWidthFromRps(rps: number): number {
  return Math.max(2, Math.min(12, rps / 100));
}

const MAX_PARTICLES = 500;

export default function DataRiversPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const particlesRef = useRef<RiverParticle[]>([]);
  const animFrameRef = useRef<number>(0);
  const [isSleeping, setIsSleeping] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const strokeWidthsRef = useRef<number[]>(LINKS.map((l) => strokeWidthFromRps(l.rps)));

  const setPathRef = useCallback((index: number) => (el: SVGPathElement | null) => {
    pathRefs.current[index] = el;
  }, []);

  const resolvedLinks = LINKS.map((link) => ({
    ...link,
    path: buildCurvePath(link.source, link.target),
  }));

  useEffect(() => {
    const targets = strokeWidthsRef.current.map((_, i) =>
      isSleeping ? 0 : strokeWidthFromRps(LINKS[i].rps)
    );

    pathRefs.current.forEach((pathEl, i) => {
      if (!pathEl) return;
      gsap.to(pathEl, {
        attr: { 'stroke-width': targets[i] },
        duration: isSleeping ? 1.5 : 0.8,
        ease: isSleeping ? 'power2.inOut' : 'power2.out',
      });
    });

    strokeWidthsRef.current = targets;
  }, [isSleeping]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 960;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spawnParticle = (linkIndex: number): RiverParticle => {
      const link = LINKS[linkIndex];
      const baseSpeed = (link.rps / 800) * 0.008 * speedMultiplier;
      return {
        linkIndex,
        progress: 0,
        speed: baseSpeed + Math.random() * 0.003,
        color: latencyColor(link.latencyMs),
        radius: 2 + Math.random() * 2,
      };
    };

    let spawnAccum = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isSleeping) {
        spawnAccum += 1;
        if (spawnAccum >= 2) {
          spawnAccum = 0;
          LINKS.forEach((_, i) => {
            const density = LINKS[i].rps / 200;
            if (Math.random() < density * 0.3) {
              if (particlesRef.current.length < MAX_PARTICLES) {
                particlesRef.current.push(spawnParticle(i));
              }
            }
          });
        }
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        if (isSleeping) return true;
        return p.progress < 1;
      });

      for (const particle of particlesRef.current) {
        if (!isSleeping) {
          particle.progress += particle.speed;
        }

        const pathEl = pathRefs.current[particle.linkIndex];
        if (!pathEl) continue;

        const totalLen = pathEl.getTotalLength();
        const point = pathEl.getPointAtLength(particle.progress * totalLen);

        ctx.beginPath();
        ctx.arc(point.x, point.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = isSleeping ? 0.3 : 0.85;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSleeping, speedMultiplier]);

  const handleToggle = useCallback(() => {
    if (!isSleeping) {
      particlesRef.current = [];
    }
    setIsSleeping((prev) => !prev);
  }, [isSleeping]);

  const handleSpeedChange = useCallback((_: Event, value: number | number[]) => {
    setSpeedMultiplier(value as number);
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
        sx={{ color: '#fff', textAlign: 'center', pt: 4, mb: 2, fontWeight: 700 }}
      >
        Data Flow Rivers
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#66bb6a' }} />
          <Typography variant="caption" sx={{ color: '#90a4ae' }}>{'<100ms'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ffa726' }} />
          <Typography variant="caption" sx={{ color: '#90a4ae' }}>100-500ms</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef5350' }} />
          <Typography variant="caption" sx={{ color: '#90a4ae' }}>{'> 500ms'}</Typography>
        </Box>
      </Box>

      <Box sx={{ position: 'relative', width: 960, height: 560 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 960 560"
          width="960"
          height="560"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {resolvedLinks.map((link, i) => (
            <path
              key={`${link.source}-${link.target}`}
              ref={setPathRef(i)}
              d={link.path}
              fill="none"
              stroke={latencyColor(link.latencyMs)}
              strokeWidth={strokeWidthFromRps(link.rps)}
              strokeOpacity={0.25}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 960,
            height: 560,
            pointerEvents: 'none',
          }}
        />

        {SERVICES.map((service) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              position: 'absolute',
              left: service.x,
              top: service.y,
              width: BOX_W,
              height: BOX_H,
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: '#e6edf3', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center' }}
              >
                {service.label}
              </Typography>
              <Typography variant="caption" sx={{ color: '#546e7a', fontSize: '0.6rem' }}>
                {getServiceStats(service.id)}
              </Typography>
            </Box>
          </motion.div>
        ))}
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
            K15 — Data Flow Rivers
          </Typography>

          <Button
            size="small"
            variant="outlined"
            onClick={handleToggle}
            sx={{
              color: isSleeping ? '#66bb6a' : '#7986cb',
              borderColor: isSleeping ? '#388e3c' : '#3949ab',
              textTransform: 'none',
              fontSize: '0.7rem',
            }}
          >
            {isSleeping ? 'Wake' : 'Sleep'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
            <Typography variant="caption" sx={{ color: '#607d8b' }}>
              Speed:
            </Typography>
            <Slider
              value={speedMultiplier}
              onChange={handleSpeedChange}
              min={0.25}
              max={3}
              step={0.25}
              size="small"
              sx={{
                width: 120,
                color: '#546e7a',
                '& .MuiSlider-thumb': { width: 12, height: 12 },
              }}
            />
            <Typography variant="caption" sx={{ color: '#607d8b' }}>
              {speedMultiplier}x
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Status: {isSleeping ? 'Sleeping' : 'Active'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Particles: {particlesRef.current.length}
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
}

function getServiceStats(serviceId: string): string {
  const outgoing = LINKS.filter((l) => l.source === serviceId);
  const incoming = LINKS.filter((l) => l.target === serviceId);
  const totalOut = outgoing.reduce((sum, l) => sum + l.rps, 0);
  const totalIn = incoming.reduce((sum, l) => sum + l.rps, 0);

  if (totalOut > 0 && totalIn > 0) return `${totalIn} RPS in / ${totalOut} RPS out`;
  if (totalOut > 0) return `${totalOut} RPS out`;
  if (totalIn > 0) return `${totalIn} RPS in`;
  return 'idle';
}
