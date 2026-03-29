import { db } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/guardrails', (_req, res) => {
    res.json(200, db.guardrails)
  })

  router.add('PUT', '/api/guardrails', (req, res) => {
    Object.assign(db.guardrails, req.body, { updatedAt: new Date().toISOString() })
    res.json(200, db.guardrails)
  })
}
