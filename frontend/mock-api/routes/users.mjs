import { db, nextId } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/users', (_req, res) => {
    res.json(200, db.users)
  })

  router.add('POST', '/api/users', (req, res) => {
    const user = {
      id: nextId('user'),
      username: req.body.username,
      givenName: req.body.givenName ?? '',
      familyName: req.body.familyName ?? '',
      email: req.body.email ?? '',
      role: req.body.role ?? 'viewer',
      source: 'local',
      enabled: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      permissions: req.body.role === 'admin'
        ? ['view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'user.manage', 'admin.reset_db', 'audit.view', 'password.change']
        : req.body.role === 'operator'
          ? ['view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'audit.view', 'password.change']
          : ['view.all', 'password.change'],
    }
    db.users.push(user)
    res.json(201, user)
  })

  router.add('PUT', '/api/users/:id', (req, res) => {
    const user = db.users.find((u) => u.id === Number(req.params.id))
    if (!user) return res.json(404, { error: 'User not found' })
    if (req.body.role !== undefined) user.role = req.body.role
    if (req.body.enabled !== undefined) user.enabled = req.body.enabled
    res.json(200, user)
  })

  router.add('DELETE', '/api/users/:id', (req, res) => {
    const idx = db.users.findIndex((u) => u.id === Number(req.params.id))
    if (idx === -1) return res.json(404, { error: 'User not found' })
    db.users.splice(idx, 1)
    res.noContent()
  })
}
