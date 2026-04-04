'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { useTheme, alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'

// ── Types ────────────────────────────────────────────────────────────────────

interface LiveMetrics {
  rpsIn: number
  rpsOut: number
  latencyMs: number
  errorRate: number
  status: 'ok' | 'warn' | 'crit'
}

interface LinkEntry {
  sourceLabel?: string
  targetLabel?: string
  rps: number
  category: string
}

interface RiversComponentPreviewProps {
  component: {
    id: string
    label: string
    sublabel: string
    kind: string
    goFile: string
  }
  position: { x: number; y: number; above: boolean }
  liveMetrics?: LiveMetrics
  limits?: { label: string; value: string }[]
  incomingLinks: LinkEntry[]
  outgoingLinks: LinkEntry[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  http: '#60A5FA',
  k8s: '#A78BFA',
  store: '#34D399',
  internal: '#94A3B8',
  ws: '#FBBF24',
}

const STATUS_COLORS: Record<string, string> = {
  ok: '#34D399',
  warn: '#FBBF24',
  crit: '#EF4444',
}

const LATENCY_MAX_MS = 200

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'ok' | 'warn' | 'crit' }) {
  const color = STATUS_COLORS[status]
  return (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: color,
        boxShadow: `0 0 4px ${color}`,
        flexShrink: 0,
        ...(status === 'crit' && {
          animation: 'pulse-crit 1.2s ease-in-out infinite',
          '@keyframes pulse-crit': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.5, transform: 'scale(1.4)' },
          },
        }),
      }}
    />
  )
}

function Header({ label, sublabel, status }: { label: string; sublabel: string; status?: 'ok' | 'warn' | 'crit' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
      {status && <StatusDot status={status} />}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ display: 'block', fontSize: '0.68rem' }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.52rem' }}>
          {sublabel}
        </Typography>
      </Box>
    </Box>
  )
}

function RpsGrid({ rpsIn, rpsOut }: { rpsIn: number; rpsOut: number }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 0.4 }}>
      <RpsCell label="In" value={rpsIn} />
      <RpsCell label="Out" value={rpsOut} />
    </Box>
  )
}

function RpsCell({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.44rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: 'text.primary' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.4rem' }}>
        req/s
      </Typography>
    </Box>
  )
}

function latencyColor(ms: number): string {
  if (ms < 80) return '#34D399'
  if (ms < 150) return '#FBBF24'
  return '#EF4444'
}

function LatencyBar({ latencyMs }: { latencyMs: number }) {
  const fraction = Math.min(latencyMs / LATENCY_MAX_MS, 1)
  const color = latencyColor(latencyMs)
  return (
    <Box sx={{ mb: 0.4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.15 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.44rem' }}>
          Latency
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.44rem', fontFamily: 'monospace', color }}>
          {latencyMs}ms
        </Typography>
      </Box>
      <Box sx={{ width: '100%', height: 3, borderRadius: 1, bgcolor: 'action.hover' }}>
        <Box sx={{ width: `${fraction * 100}%`, height: '100%', borderRadius: 1, bgcolor: color, transition: 'width 0.3s ease' }} />
      </Box>
    </Box>
  )
}

function ErrorRateDisplay({ rate }: { rate: number }) {
  if (rate <= 0) return null
  return (
    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.48rem', fontFamily: 'monospace', fontWeight: 600, color: '#EF4444', mb: 0.4 }}>
      {rate.toFixed(2)}% errors
    </Typography>
  )
}

function LiveMetricsSection({ metrics }: { metrics: LiveMetrics }) {
  return (
    <Box sx={{ mt: 0.4 }}>
      <RpsGrid rpsIn={metrics.rpsIn} rpsOut={metrics.rpsOut} />
      <LatencyBar latencyMs={metrics.latencyMs} />
      <ErrorRateDisplay rate={metrics.errorRate} />
    </Box>
  )
}

function LimitsSection({ limits }: { limits: { label: string; value: string }[] }) {
  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 0.5, px: 0.7, py: 0.4, mb: 0.4 }}>
      {limits.map((lim) => (
        <Box key={lim.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="caption" sx={{ fontSize: '0.48rem', color: 'text.secondary' }}>
            {lim.label}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.48rem', fontWeight: 600, fontFamily: 'monospace', color: 'text.primary' }}>
            {lim.value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function GoFileTag({ goFile }: { goFile: string }) {
  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 0.5, px: 0.5, py: 0.15, mb: 0.4, display: 'inline-block' }}>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.48rem', color: 'text.secondary' }}>
        {goFile}
      </Typography>
    </Box>
  )
}

function ConnectionList({ title, links, direction }: { title: string; links: LinkEntry[]; direction: 'in' | 'out' }) {
  if (links.length === 0) return null
  return (
    <Box sx={{ mb: 0.2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.48rem', fontWeight: 600 }}>
        {title}
      </Typography>
      {links.map((link, i) => (
        <ConnectionRow key={i} link={link} direction={direction} />
      ))}
    </Box>
  )
}

function ConnectionRow({ link, direction }: { link: LinkEntry; direction: 'in' | 'out' }) {
  const label = direction === 'in' ? link.sourceLabel : link.targetLabel
  const prefix = direction === 'out' ? '\u2192 ' : ''
  const dotColor = CATEGORY_COLORS[link.category] ?? '#94A3B8'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 0.4 }}>
      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontSize: '0.48rem', color: 'text.secondary' }}>
        {prefix}{label}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.44rem', fontFamily: 'monospace', fontWeight: 600, color: 'text.primary', ml: 'auto' }}>
        {link.rps} req/s
      </Typography>
    </Box>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function RiversComponentPreview({
  component,
  position,
  liveMetrics,
  limits,
  incomingLinks,
  outgoingLinks,
}: RiversComponentPreviewProps) {
  const { above } = position

  return (
    <motion.div
      initial={{ opacity: 0, y: above ? 5 : -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 15,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.5,
          py: 1,
          minWidth: 240,
          maxWidth: 360,
          boxShadow: 6,
        }}
      >
        <Header label={component.label} sublabel={component.sublabel} status={liveMetrics?.status} />
        {liveMetrics && <LiveMetricsSection metrics={liveMetrics} />}
        {limits && limits.length > 0 && <LimitsSection limits={limits} />}
        {component.goFile && <GoFileTag goFile={component.goFile} />}
        <ConnectionList title="← Incoming" links={incomingLinks} direction="in" />
        <ConnectionList title="→ Outgoing" links={outgoingLinks} direction="out" />
      </Box>
    </motion.div>
  )
}
