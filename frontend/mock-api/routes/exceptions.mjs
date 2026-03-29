import { db, nextId } from '../data.mjs'

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
}
