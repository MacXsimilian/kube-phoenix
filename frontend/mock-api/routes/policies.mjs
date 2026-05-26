import { db, nextId } from '../data.mjs'

const EXPORT_SCHEMA_VERSION = 1
const EXPORT_KIND = 'policy'

const POLICY_EXPORT_FIELDS = [
  'name', 'description', 'namespaceFilter', 'labelSelector',
  'timezone', 'mode', 'enabled', 'timeoutMinutes', 'sleepWindows',
]

function policyExportBody(p) {
  const body = {}
  for (const key of POLICY_EXPORT_FIELDS) body[key] = p[key]
  return body
}

function validatePolicyEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return 'invalid body'
  if (payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return `schemaVersion ${payload.schemaVersion} is not supported; expected ${EXPORT_SCHEMA_VERSION}`
  }
  if (payload.kind !== EXPORT_KIND) {
    return `kind "${payload.kind}" does not match endpoint (expected "${EXPORT_KIND}")`
  }
  if (!payload.policy || typeof payload.policy !== 'object') return 'policy payload is required'
  const p = payload.policy
  if (!p.name) return 'name is required'
  if (!Array.isArray(p.sleepWindows) || p.sleepWindows.length === 0) return 'sleepWindows is required'
  return ''
}

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

  // ── Export / Import ──────────────────────────────────────────────────────

  router.add('GET', '/api/policies/:id/export', (req, res) => {
    const p = db.policies.find((p) => p.id === Number(req.params.id))
    if (!p) return res.json(404, { error: 'Policy not found' })
    res.json(200, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      kind: EXPORT_KIND,
      policy: policyExportBody(p),
    })
  })

  router.add('POST', '/api/policies/import/preview', (req, res) => {
    const msg = validatePolicyEnvelope(req.body)
    if (msg) return res.json(400, { error: msg })
    const incoming = req.body.policy
    const existing = db.policies.find((p) => p.name === incoming.name)
    const preview = {
      status: existing ? 'conflict' : 'create',
      incoming,
      forcedEnabledOff: !!incoming.enabled,
      forcedModeToPlan: incoming.mode === 'apply',
    }
    if (existing) {
      preview.existingPolicy = policyExportBody(existing)
      preview.conflictByName = incoming.name
    }
    res.json(200, preview)
  })

  router.add('POST', '/api/policies/import/apply', (req, res) => {
    const msg = validatePolicyEnvelope(req.body)
    if (msg) return res.json(400, { error: msg })
    const incoming = req.body.policy
    const existing = db.policies.find((p) => p.name === incoming.name)
    const resolution = req.body.conflictResolution ?? 'overwrite'

    if (existing && resolution === 'overwrite') {
      Object.assign(existing, policyImportFields(incoming), { updatedAt: new Date().toISOString() })
      return res.json(200, { status: 'overwritten', policy: existing })
    }
    if (existing && resolution === 'rename') {
      if (!req.body.newName) return res.json(400, { error: "newName is required when conflictResolution is 'rename'" })
      if (db.policies.some((p) => p.name === req.body.newName)) {
        return res.json(409, { error: 'newName already exists; pick a different name' })
      }
      const created = newPolicyFromImport({ ...incoming, name: req.body.newName })
      db.policies.push(created)
      return res.json(201, { status: 'renamed', policy: created })
    }
    const created = newPolicyFromImport(incoming)
    db.policies.push(created)
    res.json(201, { status: 'create', policy: created })
  })
}

function policyImportFields(incoming) {
  return {
    description: incoming.description ?? '',
    namespaceFilter: incoming.namespaceFilter ?? '',
    labelSelector: incoming.labelSelector ?? '',
    timezone: incoming.timezone || 'UTC',
    timeoutMinutes: incoming.timeoutMinutes ?? 0,
    sleepWindows: incoming.sleepWindows ?? [],
    // Locked design: imported policies are forced into plan mode and disabled.
    mode: 'plan',
    enabled: false,
  }
}

function newPolicyFromImport(incoming) {
  const now = new Date().toISOString()
  return {
    id: nextId('policy'),
    name: incoming.name,
    ...policyImportFields(incoming),
    currentState: 'unknown',
    stateSince: now,
    lastSleepAt: null,
    lastWakeAt: null,
    createdAt: now,
    updatedAt: now,
    nextTransitionAt: null,
  }
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
