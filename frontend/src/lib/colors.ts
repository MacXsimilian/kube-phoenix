'use client'

import { useTheme } from '@mui/material/styles'

/** Mode-aware semantic color palette — call from any component via useColors(). */
export function semanticColors(isDark: boolean) {
  return {
    success:    isDark ? '#22C55E' : '#15803D',
    warning:    isDark ? '#F59E0B' : '#92400E',
    error:      isDark ? '#EF4444' : '#B91C1C',
    errorLight: isDark ? '#F87171' : '#B91C1C',
    info:       isDark ? '#3B82F6' : '#1D4ED8',
    muted:      isDark ? '#94A3B8' : '#475569',
    orange:     isDark ? '#F97316' : '#C2410C',
    cyan:       isDark ? '#22D3EE' : '#0369A1',
    purple:     isDark ? '#7C3AED' : '#6D28D9',
    vividYellow: isDark ? '#FACC15' : '#CA8A04',

    // Tinted backgrounds (low-alpha)
    successBg:    isDark ? 'rgba(34,197,94,0.12)'  : 'rgba(21,128,61,0.10)',
    warningBg:    isDark ? 'rgba(245,158,11,0.12)' : 'rgba(146,64,14,0.10)',
    errorBg:      isDark ? 'rgba(248,113,113,0.12)': 'rgba(185,28,28,0.10)',
    infoBg:       isDark ? 'rgba(59,130,246,0.12)'  : 'rgba(29,78,216,0.10)',
    mutedBg:      isDark ? 'rgba(148,163,184,0.12)': 'rgba(71,85,105,0.10)',
    orangeBg:     isDark ? 'rgba(249,115,22,0.12)' : 'rgba(194,65,12,0.10)',
    purpleBg:     isDark ? 'rgba(124,58,237,0.12)' : 'rgba(109,40,217,0.10)',

    // Subtle zone / row highlights
    zoneBg:       isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
  }
}

const LIGHT_COLORS = semanticColors(false)
const DARK_COLORS = semanticColors(true)

/** React hook — returns mode-aware semantic colors from the current MUI theme. */
export function useColors() {
  const theme = useTheme()
  return theme.palette.mode === 'dark' ? DARK_COLORS : LIGHT_COLORS
}

export const TIMELINE_COLORS = {
  sleep:       '#7C3AED',
  sleepGlow:   'rgba(124,58,237,0.55)',
  exception:   '#ef4444',
  exceptionBg: '#f87171',
  awake:       '#22c55e',
  awakeBg:     'rgba(34,197,94,0.18)',
  sleepBg:     'rgba(124,58,237,0.50)',
}
