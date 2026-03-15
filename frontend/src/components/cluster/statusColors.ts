import type { Workload, Node } from '@/lib/types'

/** Workload status chip colours — shared by WorkloadsTable and WorkloadDetailDrawer */
export const STATUS_COLORS: Record<Workload['status'], { bgcolor: string; color: string; label: string }> = {
  running:  { bgcolor: 'rgba(34,197,94,0.12)',  color: '#22C55E', label: 'Running'  },
  sleeping: { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Sleeping' },
  partial:  { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Partial'  },
}

/** Pod phase chip colours — shared by NodeDetailDrawer and WorkloadDetailDrawer */
export const POD_STATUS_STYLE: Record<string, { color: string; bgcolor: string }> = {
  Running:   { color: '#22C55E', bgcolor: 'rgba(34,197,94,0.12)'   },
  Pending:   { color: '#F59E0B', bgcolor: 'rgba(245,158,11,0.12)'  },
  Failed:    { color: '#F87171', bgcolor: 'rgba(248,113,113,0.12)' },
  Succeeded: { color: '#94A3B8', bgcolor: 'rgba(148,163,184,0.12)' },
}

/** Node status chip colours — shared by NodesTable and NodeDetailDrawer */
export const NODE_STATUS_MAP: Record<Node['status'], { bgcolor: string; color: string; label: string }> = {
  active:        { bgcolor: 'rgba(34,197,94,0.12)',  color: '#22C55E', label: 'Active'      },
  protected:     { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Protected'   },
  'would-drain': { bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Would Drain' },
}
