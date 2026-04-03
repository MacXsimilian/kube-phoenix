import { db } from '../data.mjs'

const PHASES = ['Validate', 'Scaling', 'Draining', 'Verify', 'Complete']

function tickRunningExecutions() {
  for (const ex of db.executions) {
    if (ex.status !== 'running') continue
    const prev = ex.progress ?? 0
    const next = prev + 0.02 + Math.random() * 0.03
    if (next >= 1) {
      ex.progress = 1
      ex.currentPhase = 'Complete'
      ex.status = 'success'
      ex.finishedAt = new Date().toISOString()
    } else {
      ex.progress = Math.round(next * 1000) / 1000
      const phaseIdx = Math.min(Math.floor(next * PHASES.length), PHASES.length - 1)
      ex.currentPhase = PHASES[phaseIdx]
    }
  }
}

export function register(router) {
  router.add('GET', '/api/policy-executions', (req, res) => {
    tickRunningExecutions()
    let items = [...db.executions]

    if (req.query.policy_id) items = items.filter((e) => e.policyId === Number(req.query.policy_id))
    if (req.query.status) items = items.filter((e) => e.status === req.query.status)
    if (req.query.direction) items = items.filter((e) => e.direction === req.query.direction)

    // Sort newest first
    items.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    const total = items.length
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10))
    const pageSize = parseInt(req.query.page_size ?? '20', 10)
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)

    res.json(200, { items, total })
  })

  router.add('GET', '/api/policy-executions/:id', (req, res) => {
    const exec = db.executions.find((e) => e.id === Number(req.params.id))
    if (!exec) return res.json(404, { error: 'Execution not found' })
    res.json(200, exec)
  })

  router.add('GET', '/api/policy-executions/:id/logs', (req, res) => {
    const logs = db.logLines
      .filter((l) => l.executionId === Number(req.params.id))
      .sort((a, b) => a.seq - b.seq)
    res.json(200, logs)
  })

  router.add('GET', '/api/policy-executions/:id/snapshots', (req, res) => {
    const snaps = db.snapshots.filter((s) =>
      s.sleepExecutionId === Number(req.params.id) || s.wakeExecutionId === Number(req.params.id),
    )
    res.json(200, snaps)
  })
}
