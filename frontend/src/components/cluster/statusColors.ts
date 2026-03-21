import { semanticColors } from '@/lib/colors'
import type { Workload, Node } from '@/lib/types'

/** Workload status chip colours — mode-aware */
export function statusColors(isDark: boolean): Record<Workload['status'], { bgcolor: string; color: string; label: string }> {
  const c = semanticColors(isDark)
  return {
    running:  { bgcolor: c.successBg, color: c.success, label: 'Running'  },
    sleeping: { bgcolor: c.warningBg, color: c.warning, label: 'Sleeping' },
    partial:  { bgcolor: c.infoBg,    color: c.info,    label: 'Partial'  },
  }
}

/** Pod phase chip colours — mode-aware */
export function podStatusStyle(isDark: boolean): Record<string, { color: string; bgcolor: string }> {
  const c = semanticColors(isDark)
  return {
    Running:   { color: c.success, bgcolor: c.successBg },
    Pending:   { color: c.warning, bgcolor: c.warningBg },
    Failed:    { color: c.errorLight, bgcolor: c.errorBg },
    Succeeded: { color: c.muted, bgcolor: c.mutedBg },
  }
}

/** Node status chip colours — mode-aware */
export function nodeStatusMap(isDark: boolean): Record<Node['status'], { bgcolor: string; color: string; label: string }> {
  const c = semanticColors(isDark)
  return {
    active:        { bgcolor: c.successBg, color: c.success, label: 'Active'      },
    protected:     { bgcolor: c.infoBg,    color: c.info,    label: 'Protected'   },
    'would-drain': { bgcolor: c.warningBg, color: c.warning, label: 'Would Drain' },
  }
}
