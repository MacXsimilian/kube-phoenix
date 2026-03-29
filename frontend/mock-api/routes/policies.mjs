import { db, nextId } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/policies', (_req, res) => {
    res.json(200, db.policies)
  })

  router.add('GET', '/api/policies/:id', (req, res) => {
    const p = db.policies.find((p) => p.id === Number(req.params.id))
    if (!p) return res.json(404, { error: 'Policy not found' })
    res.json(200, p)
  })

  router.add('POST', '/api/policies', (req, res) => {
    const now = new Date().toISOString()
    const policy = {
      id: nextId('policy'),
      name: req.body.name ?? 'Untitled',
      description: req.body.description ?? '',
      namespaceFilter: req.body.namespaceFilter ?? '',
      labelSelector: req.body.labelSelector ?? '',
      sleepWindows: req.body.sleepWindows ?? [],
      timezone: req.body.timezone ?? 'UTC',
      mode: req.body.mode ?? 'plan',
      enabled: req.body.enabled ?? false,
      timeoutMinutes: req.body.timeoutMinutes ?? 10,
      currentState: 'awake',
      stateSince: now,
      lastSleepAt: null,
      lastWakeAt: null,
      createdAt: now,
      updatedAt: now,
      nextTransitionAt: null,
    }
    db.policies.push(policy)
    res.json(201, policy)
  })

  router.add('PUT', '/api/policies/:id', (req, res) => {
    const p = db.policies.find((p) => p.id === Number(req.params.id))
    if (!p) return res.json(404, { error: 'Policy not found' })
    const editable = ['name', 'description', 'namespaceFilter', 'labelSelector', 'sleepWindows', 'timezone', 'mode', 'enabled', 'timeoutMinutes']
    for (const key of editable) {
      if (req.body[key] !== undefined) p[key] = req.body[key]
    }
    p.updatedAt = new Date().toISOString()
    res.json(200, p)
  })

  router.add('DELETE', '/api/policies/:id', (req, res) => {
    const idx = db.policies.findIndex((p) => p.id === Number(req.params.id))
    if (idx === -1) return res.json(404, { error: 'Policy not found' })
    db.policies.splice(idx, 1)
    res.noContent()
  })

  // ── Triggers ─────────────────────────────────────────────────────────────

  router.add('POST', '/api/policies/:id/sleep', (req, res) => {
    const p = db.policies.find((p) => p.id === Number(req.params.id))
    if (!p) return res.json(404, { error: 'Policy not found' })
    const exec = createExecution(p, 'sleep', req.body.mode ?? p.mode, 'manual')
    // Simulate async completion
    setTimeout(() => finishExecution(exec, p, 'sleep'), 3000)
    res.json(200, { executionId: exec.id })
  })

  router.add('POST', '/api/policies/:id/wake', (req, res) => {
    const p = db.policies.find((p) => p.id === Number(req.params.id))
    if (!p) return res.json(404, { error: 'Policy not found' })
    const exec = createExecution(p, 'wake', req.body.mode ?? p.mode, 'manual')
    setTimeout(() => finishExecution(exec, p, 'wake'), 3000)
    res.json(200, { executionId: exec.id })
  })

  router.add('POST', '/api/policies/:id/cancel', (req, res) => {
    const exec = db.executions.find((e) => e.policyId === Number(req.params.id) && e.status === 'running')
    if (!exec) return res.json(404, { error: 'No running execution' })
    exec.status = 'interrupted'
    exec.finishedAt = new Date().toISOString()
    res.json(200, exec)
  })

  // ── Snapshots ────────────────────────────────────────────────────────────

  router.add('GET', '/api/policies/:id/snapshots', (req, res) => {
    const snaps = db.snapshots.filter((s) => s.policyId === Number(req.params.id))
    res.json(200, snaps)
  })
}

function createExecution(policy, direction, mode, trigger) {
  const now = new Date().toISOString()
  const exec = {
    id: nextId('execution'),
    policyId: policy.id,
    policy: { name: policy.name },
    direction,
    trigger,
    startedAt: now,
    finishedAt: null,
    status: 'running',
    mode,
    countScaled: 0, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0,
  }
  db.executions.push(exec)
  policy.currentState = 'transitioning'

  // Seed initial log lines
  db.logLines.push(
    { id: nextId('logLine'), executionId: exec.id, seq: 1, level: 'info', message: `Starting manual ${direction} for policy "${policy.name}"`, timestamp: now },
    { id: nextId('logLine'), executionId: exec.id, seq: 2, level: 'info', message: `Evaluating namespace selectors: ${policy.namespaceFilter || '*'}`, timestamp: now },
  )
  return exec
}

function finishExecution(exec, policy, direction) {
  const now = new Date().toISOString()
  exec.status = 'success'
  exec.finishedAt = now
  exec.countScaled = 4
  policy.currentState = direction === 'sleep' ? 'sleeping' : 'awake'
  policy.stateSince = now
  if (direction === 'sleep') policy.lastSleepAt = now
  else policy.lastWakeAt = now

  db.logLines.push(
    { id: nextId('logLine'), executionId: exec.id, seq: 3, level: 'ok', message: `Found 4 matching workloads`, timestamp: now },
    { id: nextId('logLine'), executionId: exec.id, seq: 4, level: 'ok', message: `Execution completed — 4 scaled, 0 skipped, 0 errors`, timestamp: now },
  )
}
