'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import { useTheme, alpha, type Theme } from '@mui/material/styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface MinimapNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  kindColor: string
}

interface MinimapLink {
  path: string
  color: string
  active: boolean
}

interface RiversMinimapProps {
  canvasWidth: number
  canvasHeight: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  nodes: MinimapNode[]
  links: MinimapLink[]
}

interface Viewport {
  x: number
  y: number
  w: number
  h: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const MINIMAP_WIDTH = 180

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeScale(canvasWidth: number): number {
  return MINIMAP_WIDTH / canvasWidth
}

function computeMinimapHeight(canvasWidth: number, canvasHeight: number): number {
  const scale = computeScale(canvasWidth)
  return Math.round(canvasHeight * scale)
}

function readViewport(el: HTMLDivElement, scale: number): Viewport {
  return {
    x: el.scrollLeft * scale,
    y: el.scrollTop * scale,
    w: el.clientWidth * scale,
    h: el.clientHeight * scale,
  }
}

function scrollToPosition(el: HTMLDivElement, minimapX: number, minimapY: number, scale: number) {
  const diagramX = minimapX / scale
  const diagramY = minimapY / scale
  el.scrollTo({
    left: diagramX - el.clientWidth / 2,
    top: diagramY - el.clientHeight / 2,
  })
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MinimapNodes({ nodes, scale }: { nodes: MinimapNode[]; scale: number }) {
  return (
    <>
      {nodes.map((node) => (
        <rect
          key={node.id}
          x={node.x * scale}
          y={node.y * scale}
          width={Math.max(node.w * scale, 2)}
          height={Math.max(node.h * scale, 2)}
          fill={node.kindColor}
          rx={1}
        />
      ))}
    </>
  )
}

function MinimapLinks({ links, scale }: { links: MinimapLink[]; scale: number }) {
  return (
    <g transform={`scale(${scale})`}>
      {links.map((link, idx) => (
        <path
          key={idx}
          d={link.path}
          fill="none"
          stroke={link.color}
          strokeWidth={0.5 / scale}
          opacity={link.active ? 0.8 : 0.3}
        />
      ))}
    </g>
  )
}

function ViewportIndicator({ viewport, theme }: { viewport: Viewport; theme: Theme }) {
  return (
    <rect
      x={viewport.x}
      y={viewport.y}
      width={viewport.w}
      height={viewport.h}
      fill={alpha(theme.palette.common.white, 0.12)}
      stroke={alpha(theme.palette.common.white, 0.6)}
      strokeWidth={1}
      rx={1}
    />
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

function RiversMinimap({ canvasWidth, canvasHeight, scrollRef, nodes, links }: RiversMinimapProps) {
  const theme = useTheme()
  const [visible, setVisible] = useState(true)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, w: 0, h: 0 })
  const dragging = useRef(false)

  const scale = computeScale(canvasWidth)
  const minimapHeight = computeMinimapHeight(canvasWidth, canvasHeight)

  const updateViewport = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setViewport(readViewport(el, scale))
  }, [scrollRef, scale])

  useScrollListener(scrollRef, updateViewport)
  useResizeListener(scrollRef, updateViewport)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const el = scrollRef.current
      if (!el) return
      dragging.current = true
      const pos = svgPointerPosition(event)
      scrollToPosition(el, pos.x, pos.y, scale)
      ;(event.target as Element).setPointerCapture?.(event.pointerId)
    },
    [scrollRef, scale],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return
      const el = scrollRef.current
      if (!el) return
      const pos = svgPointerPosition(event)
      scrollToPosition(el, pos.x, pos.y, scale)
    },
    [scrollRef, scale],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  if (!visible || canvasWidth <= 0) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: MINIMAP_WIDTH,
        height: minimapHeight,
        bgcolor: alpha(theme.palette.background.paper, 0.85),
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        boxShadow: 3,
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <CloseButton onClose={() => setVisible(false)} />
      <svg
        width={MINIMAP_WIDTH}
        height={minimapHeight}
        style={{ display: 'block', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <MinimapLinks links={links} scale={scale} />
        <MinimapNodes nodes={nodes} scale={scale} />
        <ViewportIndicator viewport={viewport} theme={theme} />
      </svg>
    </Box>
  )
}

// ── Close Button ─────────────────────────────────────────────────────────────

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <IconButton
      size="small"
      onClick={onClose}
      sx={{
        position: 'absolute',
        top: 2,
        right: 2,
        zIndex: 11,
        width: 16,
        height: 16,
        p: 0,
      }}
    >
      <CloseIcon sx={{ fontSize: 12 }} />
    </IconButton>
  )
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useScrollListener(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  callback: () => void,
) {
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', callback, { passive: true })
    callback()
    return () => el.removeEventListener('scroll', callback)
  }, [scrollRef, callback])
}

function useResizeListener(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  callback: () => void,
) {
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(callback)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef, callback])
}

// ── Utilities ────────────────────────────────────────────────────────────────

function svgPointerPosition(event: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

export default RiversMinimap
