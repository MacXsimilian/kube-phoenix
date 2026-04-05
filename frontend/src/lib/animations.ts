/** Shared CSS-in-JS animation constants for log viewers. */

export const LOG_WATERFALL_SX = {
  animation: 'logSlideIn 200ms ease-out, logFlash 1.5s ease-out',
  '@keyframes logSlideIn': {
    '0%': { opacity: 0, transform: 'translateX(12px)' },
    '100%': { opacity: 1, transform: 'translateX(0)' },
  },
  '@keyframes logFlash': {
    '0%': { backgroundColor: 'rgba(255,255,255,0.06)' },
    '100%': { backgroundColor: 'transparent' },
  },
} as const
