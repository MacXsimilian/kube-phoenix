import { db, nextId } from '../data.mjs'

const EXPORT_SCHEMA_VERSION = 1
const EXPORT_KIND = 'exception'

const EXCEPTION_EXPORT_FIELDS = [
  'exceptionType', 'startsAt', 'endsAt', 'ticketRef', 'reason',
  'sleepOnEnd', 'namespaceFilter', 'labelSelector', 'workloadTargets',
]

function exceptionExportBody(ex) {
  const body = {}
  for (const key of EXCEPTION_EXPORT_FIELDS) body[key] = ex[key]
  const parent = ex.policyId == null ? null : db.policies.find((p) => p.id === ex.policyId)
  body.policyName = parent ? parent.name : null
  return body
}

function validateExceptionEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return { msg: 'invalid body', status: 400 }
  if (payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return { msg: `schemaVersion ${payload.schemaVersion} is not supported; expected ${EXPORT_SCHEMA_VERSION}`, status: 400 }
  }
  if (payload.kind !== EXPORT_KIND) {
    return { msg: `kind "${payload.kind}" does not match endpoint (expected "${EXPORT_KIND}")`, status: 400 }
  }
  const ex = payload.exception
  if (!ex || typeof ex !== 'object') return { msg: 'exception payload is required', status: 400 }
  if (!['stay_awake', 'force_sleep'].includes(ex.exceptionType)) {
    return { msg: 'exceptionType must be stay_awake or force_sleep', status: 400 }
  }
  if (!ex.startsAt) return { msg: 'startsAt is required', status: 400 }
  if (!ex.endsAt) return { msg: 'endsAt is required', status: 400 }
  const starts = new Date(ex.startsAt).getTime()
  const ends = new Date(ex.endsAt).getTime()
  if (!(ends > starts)) return { msg: 'endsAt must be after startsAt', status: 400 }
  if (starts < Date.now()) {
    return { msg: 'startsAt must be in the future; the imported exception window has already begun', status: 422 }
  }
  return { msg: '', status: 0 }
}

function resolveParent(name) {
  if (name == null || name === '') return { policyId: null, msg: '', status: 0 }
  const parent = db.policies.find((p) => p.name === name)
  if (!parent) {
    return {
      policyId: null,
      msg: `Parent policy '${name}' not found in target environment. Import the policy first, then retry.`,
      status: 422,
    }
  }
  return { policyId: parent.id, msg: '', status: 0 }
}

export function register(router) {
  router.add('GET', '/api/exceptions', (req, res) => {
    let items = [...db.exceptions]
    if (req.query.policy_id) items = items.filter((e) => e.policyId === Number(req.query.policy_id))
    if (req.query.status) items = items.filter((e) => e.status === req.query.status)
    res.json(200, items)
  })

  router.add('GET', '/api/exceptions/:id', (req, res) => {
    const ex = db.exceptions.find((e) => e.id === Number(req.params.id))
    if (!ex) return res.json(404, { error: 'Exception not found' })
    res.json(200, ex)
  })

  router.add('POST', '/api/exceptions', (req, res) => {
    const now = new Date().toISOString()
    const ex = {
      id: nextId('exception'),
      policyId: req.body.policyId ?? null,
      exceptionType: req.body.exceptionType,
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      ticketRef: req.body.ticketRef ?? '',
      reason: req.body.reason ?? '',
      sleepOnEnd: req.body.sleepOnEnd ?? false,
      namespaceFilter: req.body.namespaceFilter ?? '',
      labelSelector: req.body.labelSelector ?? '',
      status: 'pending',
      startExecutionId: null,
      endExecutionId: null,
      cancelledAt: null,
      cancelReason: '',
      createdBy: db.currentUser.username,
      createdAt: now,
      updatedAt: now,
      workloadTargets: req.body.workloadTargets ?? [],
    }
    db.exceptions.push(ex)
    res.json(201, ex)
  })

  router.add('PUT', '/api/exceptions/:id', (req, res) => {
    const ex = db.exceptions.find((e) => e.id === Number(req.params.id))
    if (!ex) return res.json(404, { error: 'Exception not found' })
    const editable = ['exceptionType', 'startsAt', 'endsAt', 'ticketRef', 'reason', 'sleepOnEnd', 'namespaceFilter', 'labelSelector', 'workloadTargets', 'policyId']
    for (const key of editable) {
      if (req.body[key] !== undefined) ex[key] = req.body[key]
    }
    ex.updatedAt = new Date().toISOString()
    res.json(200, ex)
  })

  router.add('DELETE', '/api/exceptions/:id', (req, res) => {
    const idx = db.exceptions.findIndex((e) => e.id === Number(req.params.id))
    if (idx === -1) return res.json(404, { error: 'Exception not found' })
    db.exceptions.splice(idx, 1)
    res.noContent()
  })

  // ── Export / Import ──────────────────────────────────────────────────────

  router.add('GET', '/api/exceptions/:id/export', (req, res) => {
    const ex = db.exceptions.find((e) => e.id === Number(req.params.id))
    if (!ex) return res.json(404, { error: 'Exception not found' })
    res.json(200, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      kind: EXPORT_KIND,
      exception: exceptionExportBody(ex),
    })
  })

  router.add('POST', '/api/exceptions/import/preview', (req, res) => {
    const env = validateExceptionEnvelope(req.body)
    if (env.msg) return res.json(env.status, { error: env.msg })
    const incoming = req.body.exception
    const parent = resolveParent(incoming.policyName)
    if (parent.msg) return res.json(parent.status, { error: parent.msg })
    res.json(200, {
      status: 'create',
      parentPolicyId: parent.policyId,
      parentPolicyName: incoming.policyName ?? null,
      incoming,
    })
  })

  router.add('POST', '/api/exceptions/import/apply', (req, res) => {
    const env = validateExceptionEnvelope(req.body)
    if (env.msg) return res.json(env.status, { error: env.msg })
    const incoming = req.body.exception
    const parent = resolveParent(incoming.policyName)
    if (parent.msg) return res.json(parent.status, { error: parent.msg })
    const now = new Date().toISOString()
    const ex = {
      id: nextId('exception'),
      policyId: parent.policyId,
      exceptionType: incoming.exceptionType,
      startsAt: incoming.startsAt,
      endsAt: incoming.endsAt,
      ticketRef: incoming.ticketRef ?? '',
      reason: incoming.reason ?? '',
      sleepOnEnd: incoming.sleepOnEnd ?? false,
      namespaceFilter: incoming.namespaceFilter ?? '',
      labelSelector: incoming.labelSelector ?? '',
      status: 'pending',
      startExecutionId: null,
      endExecutionId: null,
      cancelledAt: null,
      cancelReason: '',
      createdBy: db.currentUser.username,
      createdAt: now,
      updatedAt: now,
      workloadTargets: incoming.workloadTargets ?? [],
    }
    db.exceptions.push(ex)
    res.json(201, { status: 'create', exception: ex })
  })
}
