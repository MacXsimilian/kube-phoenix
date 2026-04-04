'use client'

// PROTOTYPE: Magnetic Nav Icons
// DEPS: framer-motion gsap
// LIBS: Framer Motion, GSAP
// DATA: Navigation items
// DESCRIPTION: Sidebar nav icons with magnetic cursor attraction and elastic click feedback

import { useState, useRef, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined'
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useRouter } from 'next/navigation'
import {
  motion,
  useMotionValue,
  useSpring,
  type MotionValue,
} from 'framer-motion'
import gsap from 'gsap'

interface NavItem {
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardOutlinedIcon /> },
  { label: 'Policies', icon: <GavelOutlinedIcon /> },
  { label: 'Executions', icon: <PlayCircleOutlinedIcon /> },
  { label: 'Workloads', icon: <ViewInArOutlinedIcon /> },
  { label: 'Nodes', icon: <StorageOutlinedIcon /> },
  { label: 'Metrics', icon: <InsightsOutlinedIcon /> },
  { label: 'Settings', icon: <SettingsOutlinedIcon /> },
  { label: 'Logs', icon: <TerminalOutlinedIcon /> },
]

const MAGNETIC_RADIUS = 100
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 }

function useMagneticIcon(
  mouseX: MotionValue<number>,
  mouseY: MotionValue<number>,
  sensitivity: number
) {
  const ref = useRef<HTMLDivElement>(null)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const springX = useSpring(offsetX, SPRING_CONFIG)
  const springY = useSpring(offsetY, SPRING_CONFIG)

  useEffect(() => {
    const unsubX = mouseX.on('change', () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const mx = mouseX.get()
      const my = mouseY.get()
      const dx = mx - centerX
      const dy = my - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < MAGNETIC_RADIUS) {
        const force = (1 - distance / MAGNETIC_RADIUS) * sensitivity
        offsetX.set(dx * force)
        offsetY.set(dy * force)
      } else {
        offsetX.set(0)
        offsetY.set(0)
      }
    })

    const unsubY = mouseY.on('change', () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const mx = mouseX.get()
      const my = mouseY.get()
      const dx = mx - centerX
      const dy = my - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < MAGNETIC_RADIUS) {
        const force = (1 - distance / MAGNETIC_RADIUS) * sensitivity
        offsetX.set(dx * force)
        offsetY.set(dy * force)
      } else {
        offsetX.set(0)
        offsetY.set(0)
      }
    })

    return () => {
      unsubX()
      unsubY()
    }
  }, [mouseX, mouseY, offsetX, offsetY, sensitivity])

  return { ref, springX, springY }
}

interface MagneticIconProps {
  item: NavItem
  isActive: boolean
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
  sensitivity: number
  onSelect: () => void
}

function MagneticIcon({
  item,
  isActive,
  mouseX,
  mouseY,
  sensitivity,
  onSelect,
}: MagneticIconProps) {
  const { ref, springX, springY } = useMagneticIcon(mouseX, mouseY, sensitivity)
  const iconRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    onSelect()
    if (iconRef.current) {
      gsap.fromTo(
        iconRef.current,
        { scale: 1 },
        {
          scale: 1.35,
          duration: 0.15,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            gsap.to(iconRef.current, {
              scale: 1,
              duration: 0.4,
              ease: 'elastic.out(1, 0.3)',
            })
          },
        }
      )
    }
  }, [onSelect])

  return (
    <Tooltip title={item.label} placement="right" arrow>
      <motion.div
        ref={ref}
        style={{ x: springX, y: springY, position: 'relative' }}
      >
        <Box
          ref={iconRef}
          onClick={handleClick}
          sx={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            cursor: 'pointer',
            color: isActive ? 'primary.main' : 'text.secondary',
            bgcolor: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
            boxShadow: isActive
              ? '0 0 16px rgba(56, 189, 248, 0.35)'
              : 'none',
            transition: 'color 0.2s, background-color 0.2s, box-shadow 0.2s',
            '&:hover': {
              bgcolor: isActive
                ? 'rgba(56, 189, 248, 0.18)'
                : 'rgba(255, 255, 255, 0.06)',
              color: isActive ? 'primary.light' : 'text.primary',
            },
            '& .MuiSvgIcon-root': {
              fontSize: 24,
            },
          }}
        >
          {item.icon}
        </Box>
      </motion.div>
    </Tooltip>
  )
}

export default function MagneticNavPrototype() {
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)
  const [sensitivity, setSensitivity] = useState(0.4)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    },
    [mouseX, mouseY]
  )

  const handleReset = useCallback(() => {
    setActiveIndex(0)
    setSensitivity(0.4)
  }, [])

  return (
    <Box
      onMouseMove={handleMouseMove}
      sx={{ minHeight: '100vh', position: 'relative' }}
    >
      {/* Header */}
      <Box sx={{ maxWidth: 800, mx: 'auto', pt: 4, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <IconButton onClick={() => router.push('/prototypes/')} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={800}>
              K1 — Magnetic Nav Icons
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sidebar nav icons with magnetic cursor attraction and elastic click
              feedback
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Sidebar */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 2,
          px: 1,
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '0 16px 16px 0',
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: 'none',
          zIndex: 10,
        }}
      >
        {NAV_ITEMS.map((item, index) => (
          <MagneticIcon
            key={item.label}
            item={item}
            isActive={activeIndex === index}
            mouseX={mouseX}
            mouseY={mouseY}
            sensitivity={sensitivity}
            onSelect={() => setActiveIndex(index)}
          />
        ))}
      </Box>

      {/* Active Page Indicator */}
      <Box
        sx={{
          maxWidth: 800,
          mx: 'auto',
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight={700} color="text.primary">
            {NAV_ITEMS[activeIndex].label}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Move your cursor near the sidebar icons to see the magnetic effect
          </Typography>
        </Box>
      </Box>

      {/* Dev Toolbar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          px: 3,
          py: 1.5,
          bgcolor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
        >
          K1 Magnetic Nav
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 220,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Sensitivity: {sensitivity.toFixed(2)}
          </Typography>
          <Slider
            value={sensitivity}
            onChange={(_, v) => setSensitivity(v as number)}
            min={0.1}
            max={0.8}
            step={0.05}
            size="small"
            sx={{ width: 140 }}
          />
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={handleReset}
        >
          Reset
        </Button>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto', fontFamily: 'monospace' }}
        >
          Active: {NAV_ITEMS[activeIndex].label}
        </Typography>
      </Box>
    </Box>
  )
}
