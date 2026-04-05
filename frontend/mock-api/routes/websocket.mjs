/**
 * WebSocket handler for live policy execution log streaming.
 * Requires `ws` as a devDependency: npm i -D ws
 */

import { db, nextId } from '../data.mjs'

let WebSocketServer

try {
  const ws = await import('ws')
  WebSocketServer = ws.WebSocketServer ?? ws.default?.WebSocketServer
} catch {
  console.warn('  [ws] "ws" package not installed — WebSocket mock disabled. Run: npm i -D ws')
}

let wss = null

const API_CALLS_PER_SLEEP = 4
const API_CALLS_PER_WAKE = 5

/**
 * Called by the HTTP server's `upgrade` event.
 */
export function handleUpgrade(req, socket, head) {
  if (!wss) {
    if (!WebSocketServer) {
      socket.destroy()
      return
    }
    wss = new WebSocketServer({ noServer: true })
  }

  // Match path: /ws/policy-executions/:id/logs
  const match = req.url?.match(/^\/ws\/policy-executions\/(\d+)\/logs/)
  if (!match) {
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const execId = Number(match[1])
    handleConnection(ws, execId)
  })
}

const LOG_STREAM_MIN_DELAY_MS = 1200
const LOG_STREAM_JITTER_MS = 1000
const DRAIN_TIMEOUT_PER_POD_SECS = 15
const DRAIN_TIMEOUT_BASE_SECS = 60
const MAX_LOG_LINES = 50_000

function randomDelay() {
  return LOG_STREAM_MIN_DELAY_MS + Math.random() * LOG_STREAM_JITTER_MS
}

function matchesNamespaceFilter(namespace, filter) {
  if (!filter) return true
  const patterns = filter.split(',').map((s) => s.trim()).filter(Boolean)
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      return namespace.startsWith(pattern.slice(0, -1))
    }
    return namespace === pattern
  })
}

function formatWorkload(kind, namespace, name) {
  return `${kind} ${namespace}/${name}`
}

function findMatchingWorkloads(policy) {
  const systemNamespaces = new Set(
    (db.guardrails.systemNamespaces || '').split(',').map((s) => s.trim()).filter(Boolean),
  )
  return db.workloads.filter((w) => {
    if (systemNamespaces.has(w.namespace)) return false
    return matchesNamespaceFilter(w.namespace, policy.namespaceFilter)
  })
}

function findDrainableNodes() {
  return (db.nodes || []).filter((n) => n.status === 'would-drain')
}

function buildSleepLines(policy, guardrails, workloads) {
  const lines = []
  const concurrency = guardrails.scalingConcurrency || 10

  lines.push({ level: 'info', message: `Policy sleep — namespace filter: "${policy.namespaceFilter}"  label selector: "${policy.labelSelector}"` })
  lines.push({ level: 'info', message: 'Fetching Deployments...' })
  lines.push({ level: 'info', message: 'Fetching StatefulSets...' })

  const namespaces = [...new Set(workloads.map((w) => w.namespace))]
  const nsLabel = namespaces.length === 1 ? `namespace ${namespaces[0]}` : `namespaces ${namespaces.join(', ')}`
  lines.push({ level: 'info', message: `Found ${workloads.length} matching workloads in ${nsLabel}` })

  const scalable = workloads.filter((w) => w.currentReplicas > 0)
  const totalApiCalls = scalable.length * API_CALLS_PER_SLEEP + 2
  if (scalable.length > 0) {
    lines.push({ level: 'info', message: `Estimate: sleep ${scalable.length} workloads → ~${totalApiCalls} K8s API calls with concurrency ${concurrency}` })
  }

  const isApply = policy.mode === 'apply'
  for (const w of workloads) {
    const wl = formatWorkload(w.kind, w.namespace, w.name)
    if (w.currentReplicas === 0) {
      lines.push({ level: 'info', message: `Already at 0 replicas: ${wl} (snapshotted, not scaled)` })
    } else if (isApply) {
      lines.push({ level: 'ok', message: `Slept ${wl} (was ${w.currentReplicas} replicas)` })
    } else {
      lines.push({ level: 'plan', message: `Would sleep ${wl} → 0 (currently ${w.currentReplicas} replicas)` })
    }
  }

  const drainableNodes = findDrainableNodes()
  lines.push({ level: 'info', message: 'Fetching nodes...' })
  lines.push({ level: 'info', message: 'Identifying nodes with critical workloads...' })
  if (drainableNodes.length > 0) {
    lines.push({ level: 'info', message: `Draining ${drainableNodes.length} nodes (concurrency=${concurrency})...` })
    for (const node of drainableNodes) {
      const timeout = node.podCount * DRAIN_TIMEOUT_PER_POD_SECS + DRAIN_TIMEOUT_BASE_SECS
      if (isApply) {
        lines.push({ level: 'info', message: `Draining node ${node.name} (pods=${node.podCount} timeout=${timeout}s)...` })
        lines.push({ level: 'ok', message: `Drained node ${node.name}` })
        lines.push({ level: 'ok', message: `Deleted node object ${node.name}` })
      } else {
        lines.push({ level: 'plan', message: `Would drain node ${node.name} (pods=${node.podCount} timeout=${timeout}s)` })
        lines.push({ level: 'plan', message: `Would delete node object ${node.name}` })
      }
    }
  }

  const duration = (1.5 + workloads.length * 0.8 + Math.random() * 2).toFixed(1)
  const reqPerSec = scalable.length > 0 ? (totalApiCalls / parseFloat(duration)).toFixed(1) : '0.0'
  lines.push({ level: 'info', message: `Sleep complete in ${duration}s — scaled ${scalable.length} workloads, ${workloads.length - scalable.length} skipped, 0 errors, ${totalApiCalls} K8s API calls (${reqPerSec} req/s)` })

  return { lines, countScaled: scalable.length, countSkipped: workloads.length - scalable.length }
}

function buildWakeLines(policy, guardrails, workloads) {
  const lines = []
  const concurrency = guardrails.scalingConcurrency || 10
  const waveSize = guardrails.wakeWaveSize || 0
  const wavePause = guardrails.wakeWavePauseSeconds || 90

  const snapshots = db.snapshots.filter((s) => s.policyId === policy.id && !s.restoredAt)
  const restoreTargets = snapshots.length > 0 ? snapshots : workloads.map((w) => ({
    namespace: w.namespace,
    kind: w.kind,
    name: w.name,
    replicasBefore: w.savedReplicas || w.currentReplicas || 1,
    wasAlreadyZero: false,
  }))

  lines.push({ level: 'info', message: `Policy wake — restoring ${restoreTargets.length} snapshotted workloads (namespace filter: "${policy.namespaceFilter}")` })

  const totalApiCalls = restoreTargets.length * API_CALLS_PER_WAKE
  if (restoreTargets.length > 0) {
    lines.push({ level: 'info', message: `Estimate: wake ${restoreTargets.length} workloads → ~${totalApiCalls} K8s API calls with concurrency ${concurrency}` })
  }

  const isApply = policy.mode === 'apply'
  const useWaves = waveSize > 0 && restoreTargets.length > waveSize
  const waveCount = useWaves ? Math.ceil(restoreTargets.length / waveSize) : 1

  if (useWaves) {
    const pauseLabel = wavePause >= 60 ? `${Math.floor(wavePause / 60)}m${wavePause % 60 > 0 ? (wavePause % 60) + 's' : ''}` : `${wavePause}s`
    lines.push({ level: 'info', message: `Wave scaling: ${restoreTargets.length} workloads in ${waveCount} waves of ${waveSize} (max ${pauseLabel} pause between waves)` })
  }

  let scaled = 0
  for (let waveIdx = 0; waveIdx < waveCount; waveIdx++) {
    const start = useWaves ? waveIdx * waveSize : 0
    const end = useWaves ? Math.min(start + waveSize, restoreTargets.length) : restoreTargets.length
    const waveTargets = restoreTargets.slice(start, end)

    if (useWaves) {
      lines.push({ level: 'info', message: `Wave ${waveIdx + 1}/${waveCount} — scaling ${waveTargets.length} workloads` })
    }

    for (const snap of waveTargets) {
      const wl = formatWorkload(snap.kind, snap.namespace, snap.name)
      const target = snap.replicasBefore

      if (snap.wasAlreadyZero) {
        lines.push({ level: 'info', message: `Skipping ${wl} — was already at 0 before sleep (not owned by this policy)` })
      } else if (isApply) {
        lines.push({ level: 'ok', message: `Restored ${wl} → ${target} replicas` })
        scaled++
      } else {
        lines.push({ level: 'plan', message: `Would restore ${wl} → ${target} replicas` })
        scaled++
      }
    }

    if (useWaves && waveIdx < waveCount - 1) {
      lines.push({ level: 'info', message: `Wave ${waveIdx + 1}/${waveCount}: all ${waveTargets.length} workloads ready` })
    }
  }

  const skipped = restoreTargets.length - scaled
  const duration = (1.5 + restoreTargets.length * 0.8 + Math.random() * 2).toFixed(1)
  const reqPerSec = scaled > 0 ? (totalApiCalls / parseFloat(duration)).toFixed(1) : '0.0'
  lines.push({ level: 'info', message: `Wake complete in ${duration}s — restored ${scaled} workloads, ${skipped} skipped, 0 errors, ${totalApiCalls} K8s API calls (${reqPerSec} req/s)` })

  return { lines, countScaled: scaled, countSkipped: skipped }
}

function handleConnection(ws, execId) {
  const exec = db.executions.find((e) => e.id === execId)

  if (!exec) {
    ws.send(JSON.stringify({
      id: nextId('logLine'), executionId: execId, seq: 1,
      level: 'error', message: 'Execution not found',
      timestamp: new Date().toISOString(),
    }))
    ws.close(1000, 'execution not found')
    return
  }

  const existing = db.logLines
    .filter((l) => l.executionId === execId)
    .sort((a, b) => a.seq - b.seq)

  if (exec.status !== 'running') {
    for (const line of existing) {
      ws.send(JSON.stringify(line))
    }
    ws.close(1000, 'execution complete')
    return
  }

  const policy = db.policies.find((p) => p.id === exec.policyId)
  if (!policy) {
    ws.send(JSON.stringify({
      id: nextId('logLine'), executionId: execId, seq: 1,
      level: 'error', message: 'Policy not found — cannot generate logs',
      timestamp: new Date().toISOString(),
    }))
    ws.close(1000, 'policy not found')
    return
  }
  const guardrails = db.guardrails
  const workloads = findMatchingWorkloads(policy)

  const { lines, countScaled, countSkipped } = exec.direction === 'wake'
    ? buildWakeLines(policy, guardrails, workloads)
    : buildSleepLines(policy, guardrails, workloads)

  let msgIdx = 0
  let seq = 1
  let pendingTimer = null
  let aborted = false

  function sendNext() {
    if (aborted || msgIdx >= lines.length || ws.readyState !== 1) {
      if (!aborted && exec.status === 'running') {
        aborted = true
        exec.status = 'success'
        exec.finishedAt = new Date().toISOString()
        exec.countScaled = countScaled
        exec.countSkipped = countSkipped
        policy.currentState = exec.direction === 'sleep' ? 'sleeping' : 'awake'
        policy.stateSince = exec.finishedAt
      }
      if (ws.readyState === 1) ws.close(1000, 'execution complete')
      return
    }

    const template = lines[msgIdx]
    const logLine = {
      id: nextId('logLine'),
      executionId: execId,
      seq: seq++,
      level: template.level,
      message: template.message,
      timestamp: new Date().toISOString(),
    }
    db.logLines.push(logLine)
    if (db.logLines.length > MAX_LOG_LINES) {
      db.logLines.splice(0, db.logLines.length - MAX_LOG_LINES)
    }
    ws.send(JSON.stringify(logLine))
    msgIdx++
    pendingTimer = setTimeout(sendNext, randomDelay())
  }

  pendingTimer = setTimeout(sendNext, randomDelay())
  ws.on('close', () => {
    aborted = true
    if (pendingTimer) clearTimeout(pendingTimer)
  })
}

// This file also registers a REST-compatible route stub so the router doesn't 404
// on the initial HTTP request before upgrade. Not needed since upgrade is handled
// at the server level, but we export register for consistency.
export function register() {
  // No REST routes — handled via upgrade event
}
