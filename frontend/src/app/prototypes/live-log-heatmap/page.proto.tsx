'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'

const WORKLOADS = ['api-server', 'web-frontend', 'worker', 'redis', 'checkout-svc', 'product-api', 'prometheus', 'grafana']
const COLS = 30
const LEVELS = ['info', 'warn', 'error'] as const
type Level = typeof LEVELS[number]

const LEVEL_COLORS: Record<Level, string> = {
  info: '#22C55E',
  warn: '#F59E0B',
  error: '#EF4444',
}

function randomLevel(): Level {
  const r = Math.random()
  if (r < 0.05) return 'error'
  if (r < 0.15) return 'warn'
  return 'info'
}

type Grid = Level[][]

function makeEmptyGrid(): Grid {
  return WORKLOADS.map(() => Array(COLS).fill('info') as Level[])
}

export default function LiveLogHeatmapPrototype() {
  const router = useRouter()
  const [grid, setGrid] = useState<Grid>(makeEmptyGrid)
  const [streaming, setStreaming] = useState(false)
  const [counts, setCounts] = useState({ info: 0, warn: 0, error: 0 })

  useEffect(() => {
    if (!streaming) return
    const interval = setInterval(() => {
      setGrid(prev => {
        const next = prev.map(row => {
          const newRow = [...row.slice(1), randomLevel()]
          return newRow
        })
        return next
      })
      setCounts(prev => {
        const errors = grid.flat().filter(l => l === 'error').length
        const warns = grid.flat().filter(l => l === 'warn').length
        return { info: grid.flat().length - errors - warns, warn: warns, error: errors }
      })
    }, 500)
    return () => clearInterval(interval)
  }, [streaming, grid])

  const reset = () => {
    setStreaming(false)
    setGrid(makeEmptyGrid())
    setCounts({ info: 0, warn: 0, error: 0 })
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>H7 — Live Log Heatmap</Typography>
          <Typography variant="body2" color="text.secondary">
            Scrolling heatmap grid: workloads x time. Each cell = log level. Errors glow red.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={streaming ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />} onClick={() => setStreaming(s => !s)} color={streaming ? 'warning' : 'primary'}>
          {streaming ? 'Pause' : 'Stream'}
        </Button>
        <Button variant="outlined" size="small" onClick={reset}>Reset</Button>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
          {LEVELS.map(l => (
            <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: LEVEL_COLORS[l] }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Heatmap grid */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        {WORKLOADS.map((wl, row) => (
          <Box key={wl} sx={{ display: 'flex', alignItems: 'center', mb: 0.25 }}>
            <Typography variant="caption" sx={{ width: 100, fontFamily: 'monospace', fontSize: 10, color: 'text.secondary', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {wl}
            </Typography>
            <Box sx={{ display: 'flex', gap: '2px', flex: 1 }}>
              {grid[row].map((level, col) => {
                const isError = level === 'error'
                const isWarn = level === 'warn'
                return (
                  <Box
                    key={col}
                    sx={{
                      flex: 1,
                      height: 16,
                      borderRadius: 0.5,
                      bgcolor: `${LEVEL_COLORS[level]}${isError ? 'CC' : isWarn ? '80' : '25'}`,
                      transition: 'background-color 300ms ease',
                      ...(isError && {
                        boxShadow: `0 0 4px ${LEVEL_COLORS.error}60`,
                      }),
                    }}
                  />
                )
              })}
            </Box>
          </Box>
        ))}

        {/* Time labels */}
        <Box sx={{ display: 'flex', mt: 0.5, pl: '100px' }}>
          <Typography variant="caption" sx={{ flex: 1, fontSize: 9, color: 'text.disabled' }}>← older</Typography>
          <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled' }}>now →</Typography>
        </Box>
      </Box>
    </Box>
  )
}
