'use client'
import { useTheme } from '@mui/material/styles'

export function useIsDark(): boolean {
  return useTheme().palette.mode === 'dark'
}
