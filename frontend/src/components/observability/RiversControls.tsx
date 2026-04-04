'use client'

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import DownloadIcon from '@mui/icons-material/Download'
import { useTheme, alpha } from '@mui/material/styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface ZoomControlsProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onReset: () => void
}

interface ExportButtonProps {
  svgRef: React.RefObject<SVGSVGElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  filename?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3.0
const ZOOM_DEFAULT = 1.0
const BUTTON_SIZE = 28

// ── ZoomControls ─────────────────────────────────────────────────────────────

function ZoomButton({ icon, onClick, label }: {
  icon: React.ReactNode
  onClick: () => void
  label: string
}) {
  const theme = useTheme()

  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      sx={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        color: theme.palette.text.secondary,
        '&:hover': { color: theme.palette.text.primary },
      }}
    >
      {icon}
    </IconButton>
  )
}

export function ZoomControls({ zoom, onZoomChange, onReset }: ZoomControlsProps) {
  const theme = useTheme()

  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(zoom + ZOOM_STEP, ZOOM_MAX))
  }, [zoom, onZoomChange])

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(zoom - ZOOM_STEP, ZOOM_MIN))
  }, [zoom, onZoomChange])

  const handleReset = useCallback(() => {
    onReset()
  }, [onReset])

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        bgcolor: alpha(theme.palette.background.paper, 0.85),
        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        borderRadius: 1.5,
        p: 0.5,
      }}
    >
      <ZoomButton icon={<ZoomInIcon fontSize="small" />} onClick={handleZoomIn} label="Zoom in" />
      <ZoomButton icon={<ZoomOutIcon fontSize="small" />} onClick={handleZoomOut} label="Zoom out" />
      <ZoomButton icon={<CenterFocusStrongIcon fontSize="small" />} onClick={handleReset} label="Reset zoom" />
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: 10, mt: 0.25 }}>
        {zoom.toFixed(zoom % 1 === 0 ? 1 : 2)}x
      </Typography>
    </Box>
  )
}

// ── ExportButton ─────────────────────────────────────────────────────────────

function serializeSvgToDataUrl(svg: SVGSVGElement): string {
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function createOffscreenCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create canvas context')
  return ctx
}

export function ExportButton({ svgRef, canvasRef, filename = 'api-rivers' }: ExportButtonProps) {
  const theme = useTheme()
  const [exporting, setExporting] = useState(false)

  const handleExport = useCallback(async () => {
    const svg = svgRef.current
    if (!svg) return

    setExporting(true)
    try {
      await renderAndDownload(svg, canvasRef.current, filename)
    } finally {
      setExporting(false)
    }
  }, [svgRef, canvasRef, filename])

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<DownloadIcon fontSize="small" />}
      disabled={exporting}
      onClick={handleExport}
      sx={{
        textTransform: 'none',
        fontSize: 12,
        color: theme.palette.text.secondary,
        borderColor: alpha(theme.palette.divider, 0.4),
        '&:hover': { borderColor: theme.palette.divider },
      }}
    >
      {exporting ? 'Exporting...' : 'Export PNG'}
    </Button>
  )
}

// ── Export Helpers ────────────────────────────────────────────────────────────

function renderAndDownload(
  svg: SVGSVGElement,
  particleCanvas: HTMLCanvasElement | null,
  filename: string,
): Promise<void> {
  const { width, height } = svg.getBoundingClientRect()
  const ctx = createOffscreenCanvas(width, height)
  const dataUrl = serializeSvgToDataUrl(svg)

  return drawSvgToCanvas(ctx, dataUrl, width, height)
    .then(() => {
      if (particleCanvas) ctx.drawImage(particleCanvas, 0, 0)
      return canvasToBlob(ctx.canvas)
    })
    .then((blob) => downloadBlob(blob, `${filename}.png`))
}

function drawSvgToCanvas(
  ctx: CanvasRenderingContext2D,
  dataUrl: string,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      resolve()
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Failed to create PNG blob'))
      resolve(blob)
    }, 'image/png')
  })
}
