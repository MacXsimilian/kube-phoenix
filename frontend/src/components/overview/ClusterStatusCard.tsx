'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import Skeleton from '@mui/material/Skeleton'
import { getOverview, triggerPolicySleep, triggerPolicyWake, getPolicies } from '@/lib/api'
import { timeUntil } from '@/lib/formatters'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { canTriggerSchedules } from '@/lib/rbac'
import { useColors } from '@/lib/colors'
import { useClusterStream } from '@/lib/useClusterStream'
import { SNACKBAR_AUTO_HIDE_MS } from '@/lib/constants'

const statusPulseAnimation = {
  animation: 'statusPulse 2s ease-in-out infinite',
  '@keyframes statusPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
} as const

export default function ClusterStatusCard() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user } = useAuth()
  const hasTrigger = canTriggerSchedules(user?.permissions)
  const colors = useColors()

  // Single overview query — fed by SSE in real time, polls as fallback
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ['overview'],
    queryFn: getOverview,
    staleTime: 25_000,
    refetchInterval: 30_000,
  })

  // Policies for trigger button (find first enabled apply-mode policy)
  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: getPolicies,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Subscribe to SSE — updates the overview query cache in real time
  const streamDisconnected = useClusterStream()

  const [triggerError, setTriggerError] = useState<string | null>(null)

  // Find first enabled policy for quick sleep/wake triggers
  const firstPolicy = policies.find(p => p.enabled)

  const sleepMut = useMutation({
    mutationFn: () => {
      if (!firstPolicy) throw new Error('No enabled policy found')
      return triggerPolicySleep(firstPolicy.id)
    },
    onSuccess: ({ executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      router.push(`/policies/detail/?id=${firstPolicy!.id}&exec=${executionId}`)
    },
    onError: (err: unknown) => {
      setTriggerError(err instanceof Error ? err.message : 'Sleep trigger failed')
    },
  })

  const wakeMut = useMutation({
    mutationFn: () => {
      if (!firstPolicy) throw new Error('No enabled policy found')
      return triggerPolicyWake(firstPolicy.id)
    },
    onSuccess: ({ executionId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      router.push(`/policies/detail/?id=${firstPolicy!.id}&exec=${executionId}`)
    },
    onError: (err: unknown) => {
      setTriggerError(err instanceof Error ? err.message : 'Wake trigger failed')
    },
  })

  const sleeping = overview?.sleepingCount ?? 0
  const running = overview?.runningCount ?? 0
  const activeNodes = overview?.nodeCount ?? 0
  const sleepingByNs = overview?.sleepingByNs ?? []
  const isPartial = sleeping > 0 && running > 0
  const isSleeping = sleeping > 0 && running === 0

  const statusColor = isSleeping ? colors.warning : isPartial ? colors.orange : colors.success
  const statusLabel = isSleeping ? 'Cluster Sleeping' : isPartial ? 'Partially Sleeping' : 'Cluster Awake'
  const StatusIcon = isSleeping ? BedtimeIcon : isPartial ? Brightness4Icon : WbSunnyIcon

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              CLUSTER STATUS
            </Typography>
            {streamDisconnected && (
              <Chip label="Live updates paused" size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(245,158,11,0.15)', color: 'warning.main' }} />
            )}
          </Box>

          {isError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Could not load cluster data — showing last known state.
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
              <Skeleton variant="rounded" height={28} width={180} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Skeleton variant="rounded" height={24} width={110} />
                <Skeleton variant="rounded" height={24} width={130} />
                <Skeleton variant="rounded" height={24} width={120} />
              </Box>
            </Box>
          ) : null}

          {!isLoading && isError && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={700} color="text.secondary">
                Status Unknown
              </Typography>
            </Box>
          )}

          {!isLoading && !isError && (
            <>
              {/* Status indicator */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: sleepingByNs.length > 0 ? 1.5 : 3 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: statusColor,
                    boxShadow: `0 0 8px ${statusColor}`,
                    flexShrink: 0,
                    ...(isPartial || isSleeping ? statusPulseAnimation : {}),
                  }}
                />
                <StatusIcon sx={{ fontSize: 18, color: statusColor }} />
                <Typography variant="h6" fontWeight={700}>
                  {statusLabel}
                </Typography>
              </Box>

              {/* Partial namespace breakdown */}
              {sleepingByNs.length > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: 'rgba(249,115,22,0.07)',
                    border: '1px solid rgba(249,115,22,0.18)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: colors.orange, fontWeight: 600, display: 'block', mb: 0.75 }}>
                    {sleepingByNs.length} namespace{sleepingByNs.length !== 1 ? 's' : ''} with sleeping workloads
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {sleepingByNs.map(({ namespace, count }) => (
                      <Chip
                        key={namespace}
                        label={`${namespace} · ${count}`}
                        size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: colors.orangeBg, color: colors.orange, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Stats row */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                <Chip
                  label={`${activeNodes} Nodes Active`}
                  size="small"
                  role="link"
                  onClick={() => router.push('/cluster/?tab=nodes')}
                  sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: 'success.main', fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  label={`${running} Workloads Running`}
                  size="small"
                  role="link"
                  onClick={() => router.push('/cluster/?status=running')}
                  sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: 'info.main', fontWeight: 600, cursor: 'pointer' }}
                />
                <Chip
                  label={`${sleeping} Workloads Sleeping`}
                  size="small"
                  role="link"
                  onClick={() => router.push('/cluster/?status=sleeping')}
                  sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: 'warning.main', fontWeight: 600, cursor: 'pointer' }}
                />
              </Box>

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Tooltip title={hasTrigger && firstPolicy ? `Sleep via policy "${firstPolicy.name}"` : !hasTrigger ? 'No permission' : 'No enabled policy'} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<BedtimeIcon fontSize="small" />}
                      onClick={() => sleepMut.mutate()}
                      disabled={!hasTrigger || !firstPolicy || sleepMut.isPending}
                      sx={{ borderColor: 'divider', color: 'text.secondary' }}
                    >
                      Sleep Now
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={hasTrigger && firstPolicy ? `Wake via policy "${firstPolicy.name}"` : !hasTrigger ? 'No permission' : 'No enabled policy'} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<WbSunnyIcon fontSize="small" />}
                      onClick={() => wakeMut.mutate()}
                      disabled={!hasTrigger || !firstPolicy || wakeMut.isPending}
                      sx={{ borderColor: 'divider', color: 'text.secondary' }}
                    >
                      Wake Now
                    </Button>
                  </span>
                </Tooltip>
              </Box>

              {/* Next run badge */}
              {overview?.nextRun && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mt: 1.75,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(124,58,237,0.1)',
                    border: '1px solid rgba(124,58,237,0.2)',
                  }}
                >
                  <AccessTimeIcon sx={{ fontSize: 13, color: 'primary.light' }} />
                  <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 500 }}>
                    Next: {overview.nextRun.name} · {timeUntil(overview.nextRun.nextRun)}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Trigger error snackbar */}
      <Snackbar
        open={triggerError !== null}
        autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
        onClose={() => setTriggerError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setTriggerError(null)} sx={{ width: '100%' }}>
          {triggerError}
        </Alert>
      </Snackbar>
    </>
  )
}
