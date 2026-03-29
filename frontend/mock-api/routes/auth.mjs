import { db } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/auth/me', (req, res) => {
    res.setHeader('Set-Cookie', '__kp_csrf=mock-csrf-token; Path=/; SameSite=Lax')
    res.json(200, db.currentUser)
  })

  router.add('POST', '/api/auth/login', (req, res) => {
    const { username } = req.body
    const user = db.users.find((u) => u.username === username) ?? db.users[0]
    Object.assign(db.currentUser, user)
    res.setHeader('Set-Cookie', '__kp_csrf=mock-csrf-token; Path=/; SameSite=Lax')
    res.json(200, { user })
  })

  router.add('POST', '/api/auth/logout', (_req, res) => {
    res.json(200, {})
  })

  router.add('GET', '/api/auth/sessions', (_req, res) => {
    res.json(200, db.sessions)
  })

  router.add('PUT', '/api/auth/settings', (req, res) => {
    if (req.body.defaultTimezone) db.currentUser.defaultTimezone = req.body.defaultTimezone
    res.json(200, db.currentUser)
  })

  router.add('PUT', '/api/auth/password', (_req, res) => {
    res.json(200, db.currentUser)
  })

  router.add('GET', '/api/auth/oidc/config', (_req, res) => {
    res.json(200, db.oidcConfig)
  })

  router.add('GET', '/api/auth/oidc/login', (_req, res) => {
    res.json(200, { redirectURL: 'https://auth.example.com/authorize?mock=true' })
  })

  router.add('GET', '/api/auth/oidc/callback', (_req, res) => {
    res.json(200, { user: db.currentUser })
  })
}
