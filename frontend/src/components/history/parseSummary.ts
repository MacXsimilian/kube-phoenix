import type { LogLine } from '@/lib/types'

export type WorkloadEntry = {
  kind: 'Deployment' | 'StatefulSet'
  ns: string
  name: string
  targetReplicas: number
  action: 'scaled' | 'restored' | 'plan'
}

export type NodeEntry = {
  name: string
  action: 'drained' | 'deleted' | 'plan' | 'protected'
}

export type ParsedSummary = {
  workloads: WorkloadEntry[]
  nodes: NodeEntry[]
  errors: string[]
}

export function parseSummary(lines: LogLine[]): ParsedSummary {
  const workloads: WorkloadEntry[] = []
  const nodeMap = new Map<string, NodeEntry>()
  const errors: string[] = []

  for (const line of lines) {
    const m = line.message

    // scale-down: "Scaled Deployment ns/name → 0"
    const scaled = m.match(/^Scaled (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (scaled) {
      workloads.push({ kind: scaled[1] as WorkloadEntry['kind'], ns: scaled[2], name: scaled[3], targetReplicas: parseInt(scaled[4]), action: 'scaled' })
      continue
    }

    // scale-up: "Restored Deployment ns/name → N"
    const restored = m.match(/^Restored (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (restored) {
      workloads.push({ kind: restored[1] as WorkloadEntry['kind'], ns: restored[2], name: restored[3], targetReplicas: parseInt(restored[4]), action: 'restored' })
      continue
    }

    // plan: "Would scale|restore Deployment ns/name → N"
    const planned = m.match(/^Would (?:scale|restore) (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)$/)
    if (planned) {
      workloads.push({ kind: planned[1] as WorkloadEntry['kind'], ns: planned[2], name: planned[3], targetReplicas: parseInt(planned[4]), action: 'plan' })
      continue
    }

    // nodes
    const drained = m.match(/^Drained node (\S+)$/)
    if (drained) { nodeMap.set(drained[1], { name: drained[1], action: 'drained' }); continue }

    const deleted = m.match(/^Deleted node object (\S+)$/)
    if (deleted) { nodeMap.set(deleted[1], { name: deleted[1], action: 'deleted' }); continue }

    const wouldDrain = m.match(/^Would drain node (\S+)/)
    if (wouldDrain && !nodeMap.has(wouldDrain[1])) { nodeMap.set(wouldDrain[1], { name: wouldDrain[1], action: 'plan' }); continue }

    const protected_ = m.match(/^Protected node (\S+)/)
    if (protected_) { nodeMap.set(protected_[1], { name: protected_[1], action: 'protected' }); continue }

    if (line.level === 'error') errors.push(m)
  }

  return { workloads, nodes: Array.from(nodeMap.values()), errors }
}
