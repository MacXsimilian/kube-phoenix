'use client'

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReplayIcon from '@mui/icons-material/Replay'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const MOCK_CARDS = [
  { title: 'production-api', status: 'awake', replicas: '3/3', ns: 'prod', color: '#22C55E' },
  { title: 'staging-worker', status: 'sleeping', replicas: '0/2', ns: 'staging', color: '#7C3AED' },
  { title: 'redis-cache', status: 'awake', replicas: '1/1', ns: 'prod', color: '#22C55E' },
  { title: 'postgres-primary', status: 'awake', replicas: '1/1', ns: 'data', color: '#22C55E' },
  { title: 'cron-scheduler', status: 'sleeping', replicas: '0/1', ns: 'staging', color: '#7C3AED' },
  { title: 'nginx-ingress', status: 'awake', replicas: '2/2', ns: 'infra', color: '#22C55E' },
  { title: 'monitoring-stack', status: 'sleeping', replicas: '0/3', ns: 'observability', color: '#7C3AED' },
  { title: 'event-processor', status: 'awake', replicas: '4/4', ns: 'prod', color: '#22C55E' },
  { title: 'ml-pipeline', status: 'sleeping', replicas: '0/2', ns: 'ml', color: '#7C3AED' },
]

export default function StaggeredRevealPrototype() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [key, setKey] = useState(0)
  const [staggerMs, setStaggerMs] = useState(60)

  const replay = useCallback(() => {
    setVisible(false)
    setKey((k) => k + 1)
    setTimeout(() => setVisible(true), 50)
  }, [])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => router.push('/prototypes/')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800}>A3 — Staggered Reveal</Typography>
          <Typography variant="body2" color="text.secondary">
            Dashboard cards enter with cascading fade-up animation
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => setVisible(true)}
          disabled={visible}
        >
          Reveal Cards
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReplayIcon fontSize="small" />}
          onClick={replay}
        >
          Replay
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Stagger: {staggerMs}ms
          </Typography>
          <Slider
            value={staggerMs}
            onChange={(_, v) => setStaggerMs(v as number)}
            min={20}
            max={200}
            step={10}
            size="small"
            sx={{ width: 120 }}
          />
        </Box>
      </Box>

      {/* Demo area */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 400,
        }}
      >
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={key}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: staggerMs / 1000 } },
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 16,
              }}
            >
              {MOCK_CARDS.map((card) => (
                <motion.div
                  key={card.title}
                  variants={{
                    hidden: { opacity: 0, y: 24, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card sx={{ bgcolor: 'background.paper' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>{card.title}</Typography>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: card.color,
                            boxShadow: `0 0 6px ${card.color}`,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75 }}>
                        <Chip
                          label={card.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: `${card.color}18`,
                            color: card.color,
                          }}
                        />
                        <Chip
                          label={card.replicas}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            color: 'text.secondary',
                          }}
                        />
                        <Chip
                          label={card.ns}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: 'rgba(255,255,255,0.04)',
                            color: 'text.secondary',
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!visible && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <Typography color="text.secondary">Press &quot;Reveal Cards&quot; to start the animation</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
