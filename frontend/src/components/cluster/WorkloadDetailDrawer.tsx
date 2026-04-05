'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { getWorkloadPods } from '@/lib/api'
import { statusColors } from '@/components/cluster/statusColors'
import { useIsDark } from '@/lib/useIsDark'
import { useColors } from '@/lib/colors'
import { WORKLOAD_PODS_REFETCH_MS } from '@/lib/constants'
import type { NodePod, Workload } from '@/lib/types'
import PodRow from './PodRow'
import DetailDrawer from './DetailDrawer'

// ── sub-components ────────────────────────────────────────────────────────────

function ReplicaBar({ ready, current, saved }: { ready: number; current: number; saved: number | null }) {
  const colors = useColors()
  const total = saved ?? current
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0
  const color = pct >= 100 ? colors.success : pct > 0 ? colors.warning : colors.errorLight
  return (
    <Box sx={{ minWidth: 120 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: 11 }}>
          {ready}/{current} ready
        </Typography>
        {saved !== null && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
            saved: {saved}
          </Typography>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 } }}
      />
    </Box>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function WorkloadDetailDrawer({ workload, onClose }: { workload: Workload | null; onClose: () => void }) {
  const isDark = useIsDark()
  const colors = useColors()

  const { data: pods = [], isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.workloadPods(workload?.namespace, workload?.kind, workload?.name),
    queryFn: () => getWorkloadPods(workload!.namespace, workload!.kind, workload!.name),
    enabled: workload != null,
    refetchInterval: WORKLOAD_PODS_REFETCH_MS,
  })

  const statusColor = workload ? statusColors(isDark)[workload.status] : null

  const renderTitle = (selectedPod: NodePod | null) => {
    if (!workload) return null
    if (selectedPod) {
      return (
        <>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
            {workload.name}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}>
            {selectedPod.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {selectedPod.namespace}
          </Typography>
        </>
      )
    }
    return (
      <>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
          {workload.namespace}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}>
          {workload.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label={workload.kind}
            size="small"
            sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(124,58,237,0.12)', color: 'primary.main' }}
          />
          {statusColor && <Chip label={statusColor.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: statusColor.bgcolor, color: statusColor.color }} />}
        </Box>
      </>
    )
  }

  const renderPodTableBody = (filteredPods: NodePod[], onSelectPod: (pod: NodePod) => void) =>
    filteredPods.map((pod) => (
      <PodRow key={pod.name} pod={pod} onClick={() => onSelectPod(pod)} />
    ))

  return (
    <DetailDrawer
      open={workload != null}
      onClose={onClose}
      parentName={workload?.name ?? ''}
      pods={pods}
      isLoadingPods={isLoading}
      isErrorPods={isError}
      errorPods={error instanceof Error ? error : null}
      dataUpdatedAt={dataUpdatedAt}
      defaultWidth={560}
      podTableHeaders={['POD', 'READY', 'CPU', 'MEM', 'AGE']}
      renderPodTableBody={renderPodTableBody}
      emptyMessage="No pods found for this workload."
      closeAriaLabel="Close workload detail"
      renderTitle={renderTitle}
    >
      {workload && (
        <Box sx={{ mt: 1.5 }}>
          <ReplicaBar
            ready={workload.readyReplicas}
            current={workload.currentReplicas}
            saved={workload.savedReplicas}
          />
        </Box>
      )}
    </DetailDrawer>
  )
}
