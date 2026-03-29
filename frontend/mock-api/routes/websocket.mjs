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

const LOG_MESSAGES = [
  { level: 'info', message: 'Evaluating namespace selectors...' },
  { level: 'info', message: 'Found 4 matching workloads' },
  { level: 'ok', message: 'Scaling deployment dev/api-server from 3 to 0' },
  { level: 'ok', message: 'Scaling deployment dev/web-frontend from 2 to 0' },
  { level: 'ok', message: 'Scaling statefulset dev/redis from 1 to 0' },
  { level: 'ok', message: 'Scaling deployment dev/worker from 2 to 0' },
  { level: 'info', message: 'Waiting for pods to terminate...' },
  { level: 'info', message: 'Checking node drain eligibility for node-3' },
  { level: 'ok', message: 'Node node-3 has 0 remaining pods, eligible for drain' },
  { level: 'info', message: 'Cordoning node node-3' },
  { level: 'ok', message: 'All workloads scaled successfully' },
  { level: 'ok', message: 'Execution completed — 4 scaled, 0 skipped, 0 errors' },
]

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

function handleConnection(ws, execId) {
  const exec = db.executions.find((e) => e.id === execId)

  // Send existing log lines
  const existing = db.logLines
    .filter((l) => l.executionId === execId)
    .sort((a, b) => a.seq - b.seq)

  for (const line of existing) {
    ws.send(JSON.stringify(line))
  }

  // If execution is still running, stream new lines
  if (exec?.status === 'running') {
    let msgIdx = 0
    let seq = existing.length + 1

    const interval = setInterval(() => {
      if (msgIdx >= LOG_MESSAGES.length || ws.readyState !== 1) {
        clearInterval(interval)
        // Finish the execution
        if (exec.status === 'running') {
          exec.status = 'success'
          exec.finishedAt = new Date().toISOString()
          exec.countScaled = 4
          // Update policy state
          const policy = db.policies.find((p) => p.id === exec.policyId)
          if (policy) {
            policy.currentState = exec.direction === 'sleep' ? 'sleeping' : 'awake'
            policy.stateSince = exec.finishedAt
          }
        }
        return
      }

      const template = LOG_MESSAGES[msgIdx]
      const logLine = {
        id: nextId('logLine'),
        executionId: execId,
        seq: seq++,
        level: template.level,
        message: template.message,
        timestamp: new Date().toISOString(),
      }
      db.logLines.push(logLine)
      ws.send(JSON.stringify(logLine))
      msgIdx++
    }, 1200)

    ws.on('close', () => clearInterval(interval))
  }
}

// This file also registers a REST-compatible route stub so the router doesn't 404
// on the initial HTTP request before upgrade. Not needed since upgrade is handled
// at the server level, but we export register for consistency.
export function register() {
  // No REST routes — handled via upgrade event
}
