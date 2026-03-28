#!/usr/bin/env node

/**
 * Tiny mock API server for viewing prototypes without the real backend.
 *
 * Usage:  node mock-api.mjs
 * Then:   NEXT_PUBLIC_API_URL=http://localhost:4444 npm run dev
 * Open:   http://localhost:3000/settings/prototypes
 */

import { createServer } from 'node:http'

const PORT = 4444

const routes = {
  'GET /api/auth/me': {
    id: 1,
    username: 'admin',
    givenName: 'Max',
    familyName: 'Mustermann',
    email: 'admin@example.com',
    role: 'admin',
    source: 'local',
    enabled: true,
    createdAt: '2025-01-01T00:00:00Z',
    lastLoginAt: '2026-03-28T10:00:00Z',
    permissions: [
      'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit',
      'user.manage', 'admin.reset_db', 'audit.view', 'password.change',
    ],
  },
  'GET /api/auth/oidc/config': {
    enabled: true,
    mounted: true,
    issuerURL: 'https://auth.example.com',
    clientID: 'kube-phoenix-prod',
    redirectURL: 'https://phoenix.example.com/callback',
    groupsClaim: 'groups',
    roleAdminGroups: ['platform-admins'],
    roleOperatorGroups: ['platform-operators', 'sre-team'],
  },
  'GET /api/policies': [],
  'GET /api/guardrails': {
    id: 1,
    systemNamespaces: 'kube-system,kube-node-lease',
    skipNsNode: '',
    skipNodeLabels: '',
    skipNodeTaints: '',
    scalingPriorityNamespaces: '',
    schedulerEvalInterval: '30s',
    schedulerAutoWake: true,
    schedulerReconcileWhileAwake: true,
    updatedAt: '2026-03-28T00:00:00Z',
  },
}

const server = createServer((req, res) => {
  // credentials: 'include' requires an explicit origin, not '*'
  const origin = req.headers.origin || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const key = `${req.method} ${req.url?.split('?')[0]}`
  const body = routes[key]

  if (body !== undefined) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not mocked' }))
  }

  console.log(`${res.statusCode} ${key}`)
})

server.listen(PORT, () => {
  console.log(`Mock API running on http://localhost:${PORT}`)
  console.log(`\nStart frontend with:\n  NEXT_PUBLIC_API_URL=http://localhost:${PORT} npm run dev\n`)
})
