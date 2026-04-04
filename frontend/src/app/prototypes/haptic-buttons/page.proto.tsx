'use client';

// PROTOTYPE: Haptic-Style Button Feedback
// DEPS: framer-motion gsap
// LIBS: GSAP, Framer Motion
// DATA: Action button states
// DESCRIPTION: Critical action buttons with haptic visual feedback animations

import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface ButtonAction {
  label: string;
  lastTriggered: string;
}

function SleepButton({ action }: { action: ButtonAction }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = useCallback(() => {
    const btn = buttonRef.current;
    const icon = iconRef.current;
    if (!btn || !icon) return;

    gsap.timeline()
      .to(btn, { scaleY: 0.85, scaleX: 1.05, duration: 0.1, ease: 'power2.in' })
      .to(btn, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.4)' });

    gsap.to(icon, { rotation: '+=360', duration: 0.6, ease: 'power2.out' });

    setConfirmed(true);
    const timer = setTimeout(() => setConfirmed(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <motion.button
        ref={buttonRef}
        onClick={handleClick}
        whileHover={{ scale: 1.03 }}
        style={{
          background: confirmed ? '#1565c0' : '#1976d2',
          border: 'none',
          borderRadius: 12,
          padding: '16px 40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 200,
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        <Box ref={iconRef} sx={{ display: 'flex', color: '#fff' }}>
          <DarkModeIcon />
        </Box>
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
          {confirmed ? 'Confirmed!' : action.label}
        </Typography>
      </motion.button>
      <Typography variant="caption" sx={{ color: '#607d8b' }}>
        Last triggered: {action.lastTriggered}
      </Typography>
    </Box>
  );
}

function WakeButton({ action }: { action: ButtonAction }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    gsap.timeline()
      .to(btn, { scale: 1.15, duration: 0.12, ease: 'power2.out' })
      .to(btn, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.3)' });

    setConfirmed(true);
    const timer = setTimeout(() => setConfirmed(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <motion.button
        ref={buttonRef}
        onClick={handleClick}
        whileHover={{ scale: 1.03 }}
        style={{
          background: confirmed ? '#2e7d32' : '#388e3c',
          border: 'none',
          borderRadius: 12,
          padding: '16px 40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 200,
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        <motion.div
          animate={confirmed ? { rotate: 360 } : {}}
          transition={{ duration: 0.6 }}
          style={{ display: 'flex', color: '#fff' }}
        >
          <LightModeIcon />
        </motion.div>
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
          {confirmed ? 'Waking!' : action.label}
        </Typography>
      </motion.button>
      <Typography variant="caption" sx={{ color: '#607d8b' }}>
        Last triggered: {action.lastTriggered}
      </Typography>
    </Box>
  );
}

function CancelButton({ action }: { action: ButtonAction }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    gsap.to(btn, {
      keyframes: [
        { x: 0, duration: 0 },
        { x: -8, duration: 0.08 },
        { x: 8, duration: 0.08 },
        { x: -5, duration: 0.08 },
        { x: 5, duration: 0.08 },
        { x: 0, duration: 0.08 },
      ],
      ease: 'power2.inOut',
    });
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <motion.button
        ref={buttonRef}
        onClick={handleClick}
        whileHover={{ scale: 1.03 }}
        style={{
          background: '#616161',
          border: 'none',
          borderRadius: 12,
          padding: '16px 40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 200,
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        <CloseIcon sx={{ color: '#fff' }} />
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>
          {action.label}
        </Typography>
      </motion.button>
      <Typography variant="caption" sx={{ color: '#607d8b' }}>
        Last triggered: {action.lastTriggered}
      </Typography>
    </Box>
  );
}

function EmergencyScaleButton({ action }: { action: ButtonAction }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTweenRef = useRef<gsap.core.Tween | null>(null);
  const [holding, setHolding] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const HOLD_DURATION_MS = 3000;
  const CIRCUMFERENCE = 2 * Math.PI * 52;

  useEffect(() => {
    if (progressRef.current) {
      gsap.set(progressRef.current, { strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE });
    }
  }, []);

  const startHold = useCallback(() => {
    setHolding(true);
    const progress = progressRef.current;
    if (!progress) return;

    holdTweenRef.current = gsap.to(progress, {
      strokeDashoffset: 0,
      duration: HOLD_DURATION_MS / 1000,
      ease: 'linear',
    });

    holdTimerRef.current = setTimeout(() => {
      setTriggered(true);
      setHolding(false);

      const btn = buttonRef.current;
      if (btn) {
        gsap.timeline()
          .to(btn, { scale: 1.1, duration: 0.1 })
          .to(btn, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
      }

      const resetTimer = setTimeout(() => {
        setTriggered(false);
        gsap.set(progress, { strokeDashoffset: CIRCUMFERENCE });
      }, 2000);

      return () => clearTimeout(resetTimer);
    }, HOLD_DURATION_MS);
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdTweenRef.current) {
      holdTweenRef.current.kill();
    }
    setHolding(false);

    const progress = progressRef.current;
    const btn = buttonRef.current;
    if (progress) {
      gsap.to(progress, { strokeDashoffset: CIRCUMFERENCE, duration: 0.3, ease: 'power2.out' });
    }
    if (btn) {
      gsap.to(btn, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdTweenRef.current) holdTweenRef.current.kill();
    };
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          style={{ position: 'absolute', top: -8, left: -8, pointerEvents: 'none' }}
        >
          <circle
            ref={progressRef}
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#f44336"
            strokeWidth="4"
            strokeLinecap="round"
            transform="rotate(-90, 60, 60)"
          />
        </svg>

        <motion.button
          ref={buttonRef}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          whileHover={{ backgroundColor: '#d32f2f' }}
          whileFocus={{ x: [0, -3, 3, -2, 2, 0] }}
          style={{
            background: triggered ? '#b71c1c' : '#c62828',
            border: 'none',
            borderRadius: 12,
            padding: '16px 24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 104,
            justifyContent: 'center',
            outline: 'none',
            userSelect: 'none',
          }}
        >
          <WarningAmberIcon sx={{ color: '#fff' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.2 }}>
              {triggered ? 'SCALED!' : action.label}
            </Typography>
            {holding && (
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem' }}>
                Hold 3s to confirm...
              </Typography>
            )}
          </Box>
        </motion.button>
      </Box>
      <Typography variant="caption" sx={{ color: '#607d8b' }}>
        Last triggered: {action.lastTriggered}
      </Typography>
    </Box>
  );
}

const ACTIONS: ButtonAction[] = [
  { label: 'Sleep Now', lastTriggered: '2m ago' },
  { label: 'Wake Now', lastTriggered: '14m ago' },
  { label: 'Cancel', lastTriggered: '1h ago' },
  { label: 'Emergency Scale', lastTriggered: '3d ago' },
];

export default function HapticButtonsPrototype() {
  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        bgcolor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        pb: 10,
      }}
    >
      <Typography
        variant="h4"
        sx={{ color: '#fff', fontWeight: 700 }}
      >
        Haptic-Style Button Feedback
      </Typography>

      <Typography variant="body2" sx={{ color: '#90a4ae', maxWidth: 500, textAlign: 'center' }}>
        Each button uses a different micro-interaction pattern. The Emergency Scale button
        requires a 3-second hold to confirm.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          gap: 5,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
          px: 4,
        }}
      >
        <SleepButton action={ACTIONS[0]} />
        <WakeButton action={ACTIONS[1]} />
        <CancelButton action={ACTIONS[2]} />
        <EmergencyScaleButton action={ACTIONS[3]} />
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
            K14 — Haptic-Style Button Feedback
          </Typography>
          <Typography variant="caption" sx={{ color: '#607d8b' }}>
            Sleep: compress + spring | Wake: expand + contract | Cancel: shake | Emergency: 3s hold ring
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
}
