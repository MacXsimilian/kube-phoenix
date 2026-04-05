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

export type ExecutionStats = {
  operation: 'scaled' | 'restored'
  duration: string
  scaled: number
  skipped: number
  errors: number
  apiCalls: number
  throughput: string
}

export type ParsedSummary = {
  workloads: WorkloadEntry[]
  nodes: NodeEntry[]
  errors: string[]
  stats: ExecutionStats | null
}

export function parseSummary(lines: LogLine[]): ParsedSummary {
  const workloads: WorkloadEntry[] = []
  const nodeMap = new Map<string, NodeEntry>()
  const errors: string[] = []

  for (const line of lines) {
    const m = line.message

    // sleep (apply): "Slept Deployment ns/name (was 3 replicas)"
    const slept = m.match(/^Slept (Deployment|StatefulSet) (\S+)\/(\S+) \(was (\d+) replicas\)$/)
    if (slept) {
      workloads.push({ kind: slept[1] as WorkloadEntry['kind'], ns: slept[2], name: slept[3], targetReplicas: 0, action: 'scaled' })
      continue
    }

    // enforce sleep: "Enforced sleep on Deployment ns/name (was 2 replicas)"
    const enforced = m.match(/^Enforced sleep on (Deployment|StatefulSet) (\S+)\/(\S+) \(was (\d+) replicas\)$/)
    if (enforced) {
      workloads.push({ kind: enforced[1] as WorkloadEntry['kind'], ns: enforced[2], name: enforced[3], targetReplicas: 0, action: 'scaled' })
      continue
    }

    // wake (apply): "Restored Deployment ns/name → 8 replicas"
    const restored = m.match(/^Restored (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+) replicas$/)
    if (restored) {
      workloads.push({ kind: restored[1] as WorkloadEntry['kind'], ns: restored[2], name: restored[3], targetReplicas: parseInt(restored[4]), action: 'restored' })
      continue
    }

    // plan sleep: "Would sleep Deployment ns/name → 0 (currently 3 replicas)"
    const planSleep = m.match(/^Would (?:sleep|enforce sleep) (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+)/)
    if (planSleep) {
      workloads.push({ kind: planSleep[1] as WorkloadEntry['kind'], ns: planSleep[2], name: planSleep[3], targetReplicas: parseInt(planSleep[4]), action: 'plan' })
      continue
    }

    // plan wake: "Would restore Deployment ns/name → 8 replicas"
    const planWake = m.match(/^Would restore (Deployment|StatefulSet) (\S+)\/(\S+) → (\d+) replicas$/)
    if (planWake) {
      workloads.push({ kind: planWake[1] as WorkloadEntry['kind'], ns: planWake[2], name: planWake[3], targetReplicas: parseInt(planWake[4]), action: 'plan' })
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

  let stats: ExecutionStats | null = null
  const COMPLETE_RE = /(?:Sleep|Wake|Enforce sleep) complete in (\S+) — (scaled|restored) (\d+) workloads?, (\d+) skipped, (\d+) errors?, (\d+) K8s API calls \((\S+ req\/s)\)/
  for (let i = lines.length - 1; i >= 0; i--) {
    const cm = lines[i].message.match(COMPLETE_RE)
    if (cm) {
      stats = { operation: cm[2] as 'scaled' | 'restored', duration: cm[1], scaled: parseInt(cm[3]), skipped: parseInt(cm[4]), errors: parseInt(cm[5]), apiCalls: parseInt(cm[6]), throughput: cm[7] }
      break
    }
  }

  return { workloads, nodes: Array.from(nodeMap.values()), errors, stats }
}
