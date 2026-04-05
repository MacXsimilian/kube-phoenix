#!/usr/bin/env node

/**
 * Lightweight mock API server with path-parameter routing.
 * Zero dependencies (except `ws` for WebSocket, loaded lazily).
 */

import { createServer } from 'node:http'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.MOCK_PORT ?? '4444', 10)

// ── Tiny router ──────────────────────────────────────────────────────────────

const routes = []

export const router = {
  add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean)
    routes.push({ method: method.toUpperCase(), segments, handler })
  },
}

function matchRoute(method, pathname) {
  const incoming = pathname.split('/').filter(Boolean)
  for (const route of routes) {
    if (route.method !== method) continue
    if (route.segments.length !== incoming.length) continue
    const params = {}
    let matched = true
    for (let i = 0; i < route.segments.length; i++) {
      if (route.segments[i].startsWith(':')) {
        params[route.segments[i].slice(1)] = decodeURIComponent(incoming[i])
      } else if (route.segments[i] !== incoming[i]) {
        matched = false
        break
      }
    }
    if (matched) return { handler: route.handler, params }
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendJSON(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function send204(res) {
  res.writeHead(204)
  res.end()
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// ── Auto-discover route files ────────────────────────────────────────────────

const routeDir = join(__dirname, 'routes')
for (const file of readdirSync(routeDir).filter((f) => f.endsWith('.mjs'))) {
  const mod = await import(join(routeDir, file))
  if (typeof mod.register === 'function') mod.register(router)
}

console.log(`  Registered ${routes.length} routes from ${readdirSync(routeDir).filter(f => f.endsWith('.mjs')).length} route files`)

// ── HTTP server ──────────────────────────────────────────────────────────────

let wsUpgradeHandler = null

// Lazy-load WebSocket handler if available
try {
  const wsMod = await import(join(routeDir, 'websocket.mjs'))
  if (typeof wsMod.handleUpgrade === 'function') {
    wsUpgradeHandler = wsMod.handleUpgrade
  }
} catch { /* ws not installed or file missing — skip */ }

const server = createServer(async (req, res) => {
  // CORS
  const origin = req.headers.origin || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname
  const query = Object.fromEntries(url.searchParams.entries())
  const method = req.method.toUpperCase()

  const match = matchRoute(method, pathname)
  if (!match) {
    sendJSON(res, 404, { error: `not mocked: ${method} ${pathname}` })
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`  ${ts}  \x1b[33m404\x1b[0m  ${method} ${pathname}`)
    return
  }

  // Attach parsed data to req
  req.params = match.params
  req.query = query
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    try {
      req.body = await parseBody(req)
    } catch (err) {
      console.warn(`  [mock] Failed to parse request body: ${err.message}`)
      req.body = {}
    }
  } else {
    req.body = {}
  }

  // Attach helpers to res
  res.json = (status, data) => sendJSON(res, status, data)
  res.noContent = () => send204(res)
  res.text = (status, text) => sendText(res, status, text)

  try {
    await match.handler(req, res)
  } catch (err) {
    console.error(`  Error handling ${method} ${pathname}:`, err)
    if (!res.headersSent) sendJSON(res, 500, { error: 'Internal mock error' })
  }

  const ts = new Date().toISOString().slice(11, 19)
  const code = res.statusCode ?? 200
  const color = code < 300 ? '\x1b[32m' : code < 400 ? '\x1b[36m' : '\x1b[31m'
  console.log(`  ${ts}  ${color}${code}\x1b[0m  ${method} ${pathname}`)
})

// WebSocket upgrade
if (wsUpgradeHandler) {
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin || 'http://localhost:3000'
    // CORS for WS is handled by the ws library on connection
    wsUpgradeHandler(req, socket, head)
  })
}

// ── Export for programmatic use ──────────────────────────────────────────────

export async function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n  \x1b[36mMock API\x1b[0m running on \x1b[1mhttp://localhost:${port}\x1b[0m\n`)
      resolve(server)
    })
  })
}

// Direct execution: node mock-api/server.mjs
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/.*\//, ''))
if (isDirectRun && !process.env.__MOCK_NO_AUTOSTART) {
  startServer()
}
