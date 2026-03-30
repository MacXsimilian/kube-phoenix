'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { getNodePods } from '@/lib/api'
import { fmtCpu, fmtMem } from '@/lib/formatters'
import { nodeStatusMap } from '@/components/cluster/statusColors'
import { useIsDark } from '@/lib/useIsDark'
import { semanticColors, useColors } from '@/lib/colors'
import { NODE_PODS_REFETCH_MS } from '@/lib/constants'
import type { Node, NodePod } from '@/lib/types'
import MiniBar from './MiniBar'
import CollapsibleSection from './CollapsibleSection'
import LabelChip from './LabelChip'
import TaintChip from './TaintChip'
import PodRow from './PodRow'
import DetailDrawer from './DetailDrawer'

// ── helpers ──────────────────────────────────────────────────────────────────

const HIGHLIGHTED_LABEL_KEYS = new Set([
  'node.kubernetes.io/instance-type',
  'beta.kubernetes.io/instance-type',
  'topology.kubernetes.io/zone',
  'failure-domain.beta.kubernetes.io/zone',
  'eks.amazonaws.com/nodegroup',
  'karpenter.sh/nodepool',
  'kubernetes.io/arch',
])

function taintEffectColors(isDark: boolean) {
  const c = semanticColors(isDark)
  return {
    NoSchedule:       { color: c.orange,   bg: c.orangeBg,  borderColor: isDark ? 'rgba(249,115,22,0.2)' : 'rgba(194,65,12,0.2)' },
    NoExecute:        { color: c.error,    bg: c.errorBg,   borderColor: isDark ? 'rgba(239,68,68,0.2)'  : 'rgba(185,28,28,0.2)' },
    PreferNoSchedule: { color: c.warning,  bg: c.warningBg, borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(146,64,14,0.2)' },
  } as Record<string, { color: string; bg: string; borderColor: string }>
}

// ── main component ────────────────────────────────────────────────────────────

export interface NodeDetailDrawerProps {
  node: Node | null
  onClose: () => void
}

export default function NodeDetailDrawer({ node, onClose }: NodeDetailDrawerProps) {
  const isDark = useIsDark()
  const colors = useColors()

  const { data: pods = [], isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['node-pods', node?.name],
    queryFn: () => {
      if (!node) throw new Error('No node selected')
      return getNodePods(node.name)
    },
    enabled: node != null,
    refetchInterval: NODE_PODS_REFETCH_MS,
  })

  const statusColor = node ? nodeStatusMap(isDark)[node.status] : null
  const effectColors = useMemo(() => taintEffectColors(isDark), [isDark])

  const sortedLabels = useMemo(() => {
    if (!node?.labels) return []
    return Object.entries(node.labels)
      .map(([key, value]) => ({ key, value, highlight: HIGHLIGHTED_LABEL_KEYS.has(key) }))
      .sort((a, b) => {
        if (a.highlight !== b.highlight) return a.highlight ? -1 : 1
        return a.key.localeCompare(b.key)
      })
  }, [node?.labels])

  const renderTitle = (selectedPod: NodePod | null) => {
    if (!node) return null
    if (selectedPod) {
      return (
        <>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', mb: 0.25 }}>
            {node.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}
          >
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
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, wordBreak: 'break-all', lineHeight: 1.4 }}
        >
          {node.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {node.instanceType && (
            <Typography variant="caption" color="text.secondary">{node.instanceType}</Typography>
          )}
          {node.zone && (
            <>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.secondary">{node.zone}</Typography>
            </>
          )}
          <Typography variant="caption" color="text.disabled">·</Typography>
          {statusColor && <Chip label={statusColor.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: statusColor.bgcolor, color: statusColor.color }} />}
          {node.cordoned && (
            <Chip label="Cordoned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: colors.errorBg, color: colors.errorLight }} />
          )}
        </Box>
      </>
    )
  }

  const renderPodTableBody = (filteredPods: NodePod[], onSelectPod: (pod: NodePod) => void) => {
    const grouped = new Map<string, NodePod[]>()
    for (const pod of filteredPods) {
      if (!grouped.has(pod.namespace)) grouped.set(pod.namespace, [])
      grouped.get(pod.namespace)!.push(pod)
    }
    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
    return sorted.map(([ns, nsPods]) => (
      <React.Fragment key={ns}>
        <TableRow>
          <TableCell
            colSpan={6}
            sx={{ bgcolor: 'rgba(124,58,237,0.06)', borderBottom: '1px solid', borderColor: 'divider', py: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: 'primary.light', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>
                {ns}
              </Typography>
              <Chip
                label={`${nsPods.length} pod${nsPods.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{ height: 15, fontSize: 10 }}
              />
            </Box>
          </TableCell>
        </TableRow>
        {nsPods.map((pod) => (
          <PodRow key={pod.name} pod={pod} onClick={() => onSelectPod(pod)} showOwner />
        ))}
      </React.Fragment>
    ))
  }

  return (
    <DetailDrawer
      open={node != null}
      onClose={onClose}
      parentName={node?.name ?? ''}
      pods={pods}
      isLoadingPods={isLoading}
      isErrorPods={isError}
      errorPods={error instanceof Error ? error : null}
      dataUpdatedAt={dataUpdatedAt}
      defaultWidth={540}
      podTableHeaders={['POD', 'OWNER', 'READY', 'CPU', 'MEM', 'AGE']}
      renderPodTableBody={renderPodTableBody}
      emptyMessage="No non-daemonset pods on this node."
      closeAriaLabel="Close node detail"
      renderTitle={renderTitle}
    >
      {node && (
        <>
          {/* Resource bars */}
          <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
            <MiniBar
              used={node.cpuRequested}
              total={node.cpuAllocatable}
              label={`CPU: ${fmtCpu(node.cpuRequested)} / ${fmtCpu(node.cpuAllocatable)} reserved`}
            />
            <MiniBar
              used={node.memRequested}
              total={node.memAllocatable}
              label={`MEM: ${fmtMem(node.memRequested)} / ${fmtMem(node.memAllocatable)} reserved`}
            />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.25, fontSize: 11 }}>PODS</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11 }}>{node.podCount}</Typography>
            </Box>
          </Box>

          {/* Labels & Taints (rendered after the Divider that DetailDrawer adds) */}
          <Box sx={{ mx: -2.5 }}>
            <Divider />
            <CollapsibleSection title="Labels" count={sortedLabels.length}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {sortedLabels.map((l) => (
                  <LabelChip key={l.key} labelKey={l.key} value={l.value} highlight={l.highlight} />
                ))}
              </Box>
            </CollapsibleSection>
            {(node.taints ?? []).length > 0 && (
              <CollapsibleSection title="Taints" count={node.taints.length} defaultOpen>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {node.taints.map((t) => (
                    <TaintChip key={`${t.key}-${t.effect}`} taint={t} effectColors={effectColors} />
                  ))}
                </Box>
              </CollapsibleSection>
            )}
          </Box>
        </>
      )}
    </DetailDrawer>
  )
}
