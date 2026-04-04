'use client'

import { useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import { useTheme, alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'

// ── Types ────────────────────────────────────────────────────────────────────

interface LinkData {
  id: string
  source: string
  target: string
  label: string
  goSignature: string
  rps: number
  latencyMs: number
  category: string
}

interface RiversLinkPopoverProps {
  link: LinkData
  sourceLabel: string
  targetLabel: string
  position: { x: number; y: number }
  onClose: () => void
  onTrace: (sourceId: string) => void
  liveRps?: number
  liveLatencyMs?: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  http: '#60A5FA',
  k8s: '#A78BFA',
  store: '#34D399',
  internal: '#94A3B8',
  ws: '#FBBF24',
}

const ENTRANCE_ANIMATION = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.15, ease: 'easeOut' as const },
}

const MIN_WIDTH = 280

// ── Helpers ──────────────────────────────────────────────────────────────────

function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#94A3B8'
}

function latencyColor(ms: number): string {
  if (ms < 10) return '#22C55E'
  if (ms < 50) return '#F59E0B'
  return '#EF4444'
}

function formatRps(rps: number): string {
  return rps >= 1000 ? `${(rps / 1000).toFixed(1)}k` : rps.toFixed(1)
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function PopoverHeader({ sourceLabel, targetLabel, category }: {
  sourceLabel: string
  targetLabel: string
  category: string
}) {
  const color = categoryColor(category)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {sourceLabel}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {'\u2192'}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {targetLabel}
      </Typography>
      <Chip
        label={category}
        size="small"
        sx={{
          ml: 'auto',
          height: 20,
          fontSize: 11,
          bgcolor: alpha(color, 0.15),
          color,
        }}
      />
    </Box>
  )
}

function DescriptionRow({ label }: { label: string }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
        Description
      </Typography>
      <Typography variant="body2">{label}</Typography>
    </Box>
  )
}

function GoSourceRow({ goSignature }: { goSignature: string }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
        Go Source
      </Typography>
      <Box
        sx={{
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: isDark ? alpha('#000', 0.3) : alpha('#000', 0.06),
          fontFamily: 'monospace',
          fontSize: 11,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {goSignature}
      </Box>
    </Box>
  )
}

function LiveMetricsRow({ rps, latencyMs }: { rps: number; latencyMs: number }) {
  const latColor = latencyColor(latencyMs)

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>
        Live Metrics
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <MetricBadge label="RPS" value={formatRps(rps)} color="#60A5FA" />
        <MetricBadge label="Latency" value={`${latencyMs.toFixed(1)}ms`} color={latColor} />
      </Box>
    </Box>
  )
}

function MetricBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  )
}

function PopoverFooter({ sourceLabel, onTrace, onClose }: {
  sourceLabel: string
  onTrace: () => void
  onClose: () => void
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      <Button size="small" onClick={onClose} sx={{ textTransform: 'none' }}>
        Close
      </Button>
      <Button
        size="small"
        variant="contained"
        onClick={onTrace}
        sx={{ textTransform: 'none' }}
      >
        Trace from {sourceLabel}
      </Button>
    </Box>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RiversLinkPopover({
  link,
  sourceLabel,
  targetLabel,
  position,
  onClose,
  onTrace,
  liveRps,
  liveLatencyMs,
}: RiversLinkPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  const handleTrace = useCallback(() => {
    onTrace(link.source)
  }, [onTrace, link.source])

  const displayRps = liveRps ?? link.rps
  const displayLatency = liveLatencyMs ?? link.latencyMs

  return (
    <Box
      sx={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 1300,
      }}
    >
      <motion.div {...ENTRANCE_ANIMATION}>
        <Card
          ref={cardRef}
          elevation={8}
          sx={{ borderRadius: 2, minWidth: MIN_WIDTH, p: 2 }}
        >
          <PopoverHeader
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            category={link.category}
          />
          <DescriptionRow label={link.label} />
          <GoSourceRow goSignature={link.goSignature} />
          <LiveMetricsRow rps={displayRps} latencyMs={displayLatency} />
          <PopoverFooter
            sourceLabel={sourceLabel}
            onTrace={handleTrace}
            onClose={onClose}
          />
        </Card>
      </motion.div>
    </Box>
  )
}
