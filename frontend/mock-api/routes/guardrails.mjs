import { db } from '../data.mjs'

const EXPORT_SCHEMA_VERSION = 1
const EXPORT_KIND = 'guardrails'

// Persistence-metadata fields to strip from exports and ignore on import.
const STRIPPED = new Set(['id', 'updatedAt'])

function guardrailsBody() {
  const out = {}
  for (const [key, value] of Object.entries(db.guardrails)) {
    if (!STRIPPED.has(key)) out[key] = value
  }
  return out
}

function validateEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return 'invalid body'
  if (payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return `schemaVersion ${payload.schemaVersion} is not supported; expected ${EXPORT_SCHEMA_VERSION}`
  }
  if (payload.kind !== EXPORT_KIND) {
    return `kind "${payload.kind}" does not match endpoint (expected "${EXPORT_KIND}")`
  }
  if (!payload.guardrails || typeof payload.guardrails !== 'object') {
    return 'guardrails payload is required'
  }
  return ''
}

export function register(router) {
  router.add('GET', '/api/guardrails', (_req, res) => {
    res.json(200, db.guardrails)
  })

  router.add('PUT', '/api/guardrails', (req, res) => {
    Object.assign(db.guardrails, req.body, { updatedAt: new Date().toISOString() })
    res.json(200, db.guardrails)
  })

  router.add('GET', '/api/guardrails/export', (_req, res) => {
    res.json(200, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      kind: EXPORT_KIND,
      guardrails: guardrailsBody(),
    })
  })

  router.add('POST', '/api/guardrails/import/preview', (req, res) => {
    const msg = validateEnvelope(req.body)
    if (msg) return res.json(400, { error: msg })
    const before = guardrailsBody()
    const after = req.body.guardrails
    const differs = JSON.stringify(before) !== JSON.stringify(after)
    res.json(200, { status: 'conflict', before, after, differs })
  })

  router.add('POST', '/api/guardrails/import/apply', (req, res) => {
    const msg = validateEnvelope(req.body)
    if (msg) return res.json(400, { error: msg })
    const resolution = req.body.conflictResolution ?? 'overwrite'
    if (resolution !== 'overwrite' && resolution !== 'skip') {
      return res.json(400, { error: "conflictResolution must be 'overwrite' or 'skip' for guardrails" })
    }
    if (resolution === 'skip') {
      return res.json(200, { status: 'skipped' })
    }
    Object.assign(db.guardrails, req.body.guardrails, { updatedAt: new Date().toISOString() })
    res.json(200, { status: 'overwritten', guardrails: db.guardrails })
  })
}
