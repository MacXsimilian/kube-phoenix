'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DRAWER_MIN_WIDTH, DRAWER_MAX_WIDTH_RATIO } from './constants'

/**
 * Shared hook for resizable side drawers.
 * Returns an object with { width, onMouseDown, onTouchStart }.
 */
export function useDrawerResize(
  initial: number,
  min = DRAWER_MIN_WIDTH,
): { width: number; onMouseDown: (e: React.MouseEvent) => void; onTouchStart: (e: React.TouchEvent) => void } {
  const [drawerWidth, setDrawerWidth] = useState(initial)

  const widthRef = useRef(drawerWidth)
  useEffect(() => { widthRef.current = drawerWidth }, [drawerWidth])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current
      const onMouseMove = (mv: MouseEvent) => {
        const delta = startX - mv.clientX
        const next = Math.min(Math.max(startWidth + delta, min), window.innerWidth * DRAWER_MAX_WIDTH_RATIO)
        setDrawerWidth(Math.round(next))
      }
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [min],
  )

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const startX = e.touches[0].clientX
      const startWidth = widthRef.current
      const onTouchMove = (mv: TouchEvent) => {
        const delta = startX - mv.touches[0].clientX
        const next = Math.min(Math.max(startWidth + delta, min), window.innerWidth * DRAWER_MAX_WIDTH_RATIO)
        setDrawerWidth(Math.round(next))
      }
      const onTouchEnd = () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)
    },
    [min],
  )

  return { width: drawerWidth, onMouseDown, onTouchStart }
}
