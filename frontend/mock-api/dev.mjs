#!/usr/bin/env node

/**
 * Zero-config launcher: starts mock API + Next.js dev server in one process.
 *
 *   node mock-api/dev.mjs
 *   # or: make dev-mock
 */

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendDir = join(__dirname, '..')
const PORT = parseInt(process.env.MOCK_PORT ?? '4444', 10)

// Prevent server.mjs from auto-starting when imported by dev.mjs
process.env.__MOCK_NO_AUTOSTART = '1'

// 1. Start mock API in-process
const { startServer } = await import('./server.mjs')
await startServer(PORT)

// 2. Spawn Next.js dev server
const next = spawn('npx', ['next', 'dev', '--port', '3000'], {
  cwd: frontendDir,
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: `http://localhost:${PORT}`,
    NEXT_PUBLIC_PROTOTYPES: '1',
  },
  stdio: 'inherit',
})

// 3. Clean shutdown — kill child on Ctrl+C
function cleanup() {
  next.kill('SIGTERM')
  process.exit()
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
next.on('exit', (code) => process.exit(code ?? 0))
