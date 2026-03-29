import { db, resetDB } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/version', (_req, res) => {
    res.json(200, db.versionInfo)
  })

  router.add('GET', '/healthz', (_req, res) => {
    res.json(200, { status: 'ok' })
  })

  router.add('POST', '/api/danger/reset-db', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' })

    const steps = [
      { type: 'step', message: 'Dropping tables...' },
      { type: 'step', message: 'Recreating schema...' },
      { type: 'step', message: 'Seeding default data...' },
      { type: 'done', message: 'Database reset complete' },
    ]

    let i = 0
    const tick = setInterval(() => {
      if (i === 2) resetDB()
      res.write(JSON.stringify(steps[i]) + '\n')
      i++
      if (i >= steps.length) {
        clearInterval(tick)
        res.end()
      }
    }, 400)
  })
}
