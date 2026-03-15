'use client'

import { useState, useCallback } from 'react'

/**
 * Shared hook for resizable side drawers.
 * Returns [drawerWidth, handleResizeMouseDown, handleResizeTouchStart].
 */
export function useDrawerResize(
  initial: number,
  min = 360,
): [number, (e: React.MouseEvent) => void, (e: React.TouchEvent) => void] {
  const [drawerWidth, setDrawerWidth] = useState(initial)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = drawerWidth
      const onMouseMove = (mv: MouseEvent) => {
        const delta = startX - mv.clientX
        const next = Math.min(Math.max(startWidth + delta, min), window.innerWidth * 0.9)
        setDrawerWidth(Math.round(next))
      }
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [drawerWidth, min],
  )

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const startX = e.touches[0].clientX
      const startWidth = drawerWidth
      const onTouchMove = (mv: TouchEvent) => {
        const delta = startX - mv.touches[0].clientX
        const next = Math.min(Math.max(startWidth + delta, min), window.innerWidth * 0.9)
        setDrawerWidth(Math.round(next))
      }
      const onTouchEnd = () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)
    },
    [drawerWidth, min],
  )

  return [drawerWidth, handleResizeMouseDown, handleResizeTouchStart]
}
