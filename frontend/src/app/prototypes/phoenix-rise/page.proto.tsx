'use client'

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const STAGGER_CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

function SkeletonDashboard() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header skeleton */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Skeleton variant="circular" width={40} height={40} animation="wave" />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="rounded" width={200} height={20} animation="wave" sx={{ mb: 0.5 }} />
          <Skeleton variant="rounded" width={140} height={14} animation="wave" />
        </Box>
      </Box>

      {/* Status card skeleton */}
      <Card sx={{ bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="rounded" width={120} height={14} animation="wave" sx={{ mb: 2 }} />
          <Skeleton variant="rounded" width={240} height={28} animation="wave" sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Skeleton variant="rounded" width={110} height={24} animation="wave" />
            <Skeleton variant="rounded" width={140} height={24} animation="wave" />
            <Skeleton variant="rounded" width={130} height={24} animation="wave" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={100} height={36} animation="wave" />
            <Skeleton variant="rounded" width={100} height={36} animation="wave" />
          </Box>
        </CardContent>
      </Card>

      {/* Activity feed skeleton */}
      <Card sx={{ bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="rounded" width={130} height={14} animation="wave" sx={{ mb: 2 }} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} animation="wave" sx={{ mb: 1 }} />
          ))}
        </CardContent>
      </Card>
    </Box>
  )
}

function RevealedDashboard() {
  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={FADE_UP} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            🐦‍🔥
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>kube-phoenix</Typography>
            <Typography variant="caption" color="text.secondary">Connected to production-cluster</Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Status card */}
      <motion.div variants={FADE_UP} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <Card sx={{ bgcolor: 'background.paper', mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              CLUSTER STATUS
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: '#22C55E',
                  boxShadow: '0 0 8px #22C55E',
                }}
              />
              <Typography variant="h6" fontWeight={700}>Cluster Awake</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip label="3 Nodes Active" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', fontWeight: 600 }} />
              <Chip label="24 Workloads Running" size="small" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 600 }} />
              <Chip label="0 Sleeping" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 600 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Sleep Now</Button>
              <Button variant="outlined" size="small" sx={{ borderColor: 'divider', color: 'text.secondary' }}>Wake Now</Button>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity feed */}
      <motion.div variants={FADE_UP} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <Card sx={{ bgcolor: 'background.paper' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              RECENT ACTIVITY
            </Typography>
            {['Sleep #42 — scaled 12 workloads', 'Wake #41 — restored 12 workloads', 'Sleep #40 — scaled 10 workloads'].map((text, i) => (
              <motion.div
                key={i}
                variants={FADE_UP}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      bgcolor: i % 2 === 0 ? 'rgba(124,58,237,0.12)' : 'rgba(245,158,11,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    {i % 2 === 0 ? '🌙' : '☀️'}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{text}</Typography>
                    <Typography variant="caption" color="text.secondary">{(i + 1) * 3}m ago</Typography>
                  </Box>
                </Box>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default function PhoenixRisePrototype() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [key, setKey] = useState(0)

  const replay = useCallback(() => {
    setLoaded(false)
    setKey((k) => k + 1)
  }, [])

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>A1 — Phoenix Rise</Typography>
          <Typography variant="body2" color="text.secondary">
            Skeleton screen with shimmer → staggered content reveal
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => setLoaded(true)}
          disabled={loaded}
        >
          Simulate Data Load
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={replay}
        >
          Replay
        </Button>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 500,
        }}
      >
        <AnimatePresence mode="wait">
          {!loaded ? (
            <motion.div
              key={`skeleton-${key}`}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SkeletonDashboard />
            </motion.div>
          ) : (
            <motion.div
              key={`revealed-${key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <RevealedDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}
