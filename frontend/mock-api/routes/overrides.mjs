import { db, nextId } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/policies/:policyId/overrides', (req, res) => {
    const items = db.overrides.filter((o) => o.policyId === Number(req.params.policyId))
    res.json(200, items)
  })

  router.add('POST', '/api/policies/:policyId/overrides', (req, res) => {
    const override = {
      id: nextId('override'),
      policyId: Number(req.params.policyId),
      overrideType: req.body.overrideType,
      startsAt: req.body.startsAt ?? null,
      endsAt: req.body.endsAt ?? null,
      targetCronTime: req.body.targetCronTime ?? null,
      reason: req.body.reason ?? '',
      createdBy: db.currentUser.username,
      createdAt: new Date().toISOString(),
    }
    db.overrides.push(override)
    res.json(201, override)
  })

  router.add('DELETE', '/api/policies/:policyId/overrides/:overrideId', (req, res) => {
    const idx = db.overrides.findIndex((o) => o.id === Number(req.params.overrideId))
    if (idx === -1) return res.json(404, { error: 'Override not found' })
    db.overrides.splice(idx, 1)
    res.noContent()
  })
}
