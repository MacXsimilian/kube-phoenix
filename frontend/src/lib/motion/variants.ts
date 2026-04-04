/**
 * Shared Framer Motion variant library for kube-phoenix.
 * Import and use in any component: <motion.div variants={fadeInUp}>
 */

import type { Variants, Transition } from 'framer-motion'

// ── Duration tokens ─────────────────────────────────────────────────────────

export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  moderate: 0.4,
  slow: 0.6,
  dramatic: 0.8,
  cinematic: 1.2,
  epic: 3.0,
} as const

// ── Easing curves ───────────────────────────────────────────────────────────

export const ease = {
  decelerate: [0.22, 1, 0.36, 1] as const,
  accelerate: [0.55, 0, 1, 0.45] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  overshoot: [0.34, 1.56, 0.64, 1] as const,
  smooth: [0.25, 0.1, 0.25, 1] as const,
  dramatic: [0.6, 0.05, 0.01, 0.99] as const,
  phoenixRise: [0.17, 0.84, 0.44, 1] as const,
}

// ── Spring presets ──────────────────────────────────────────────────────────

export const spring = {
  panel: { type: 'spring' as const, stiffness: 300, damping: 30 },
  snappy: { type: 'spring' as const, stiffness: 400, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
  tactile: { type: 'spring' as const, stiffness: 500, damping: 15 },
  springy: { type: 'spring' as const, stiffness: 260, damping: 20 },
  phoenixRise: { type: 'spring' as const, stiffness: 180, damping: 12 },
} satisfies Record<string, Transition>

// ── Stagger tokens ──────────────────────────────────────────────────────────

export const stagger = {
  fast: 0.03,
  normal: 0.05,
  slow: 0.08,
  dramatic: 0.12,
} as const

// ── Reusable variants ───────────────────────────────────────────────────────

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.moderate, ease: ease.decelerate },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.moderate, ease: ease.decelerate },
  },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.moderate, ease: ease.decelerate },
  },
  exit: {
    opacity: 0,
    x: 24,
    transition: { duration: duration.fast, ease: ease.accelerate },
  },
}

export const staggerContainer = (
  staggerMs: number = stagger.normal,
  delayMs: number = 0.1,
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerMs, delayChildren: delayMs },
  },
})

export const pulseGlow: Variants = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.6, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const counterUp = {
  from: 0,
  duration: 0.4,
  ease: ease.decelerate,
} as const

// ── Flagship animation color palette ───────────────────────────────────────

export const flagshipColors = {
  sleepingBlue: '#3B82F6',
  wakingAmber: '#F59E0B',
  healthyGreen: '#22C55E',
  criticalRed: '#EF4444',
  phoenixOrange: '#F97316',
  emberGold: '#FBBF24',
  sleepPurple: '#7C3AED',
  dormantGrey: '#475569',
} as const
