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

  router.add('POST', '/api/danger/emergency-scale', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' })

    const steps = [
      { type: 'step', message: 'Stopping policy scheduler...' },
      { type: 'step', message: 'Disabling all policies...' },
      { type: 'step', message: 'Disabled 3 policies' },
      { type: 'step', message: 'Finding sleeping workloads...' },
      { type: 'step', message: 'Found 4 workloads to scale up' },
      { type: 'step', message: 'Scaled Deployment staging/api-server to 1 replica' },
      { type: 'step', message: 'Scaled Deployment staging/web-frontend to 1 replica' },
      { type: 'step', message: 'Scaled StatefulSet staging/redis to 1 replica' },
      { type: 'step', message: 'Scaled Deployment dev/worker to 1 replica' },
      { type: 'step', message: 'Scaling complete: 4 succeeded, 0 failed' },
      { type: 'step', message: 'Restarting policy scheduler...' },
      { type: 'done', message: 'Emergency scale complete. All policies disabled, sleeping workloads scaled to 1 replica.' },
    ]

    let i = 0
    const tick = setInterval(() => {
      res.write(JSON.stringify(steps[i]) + '\n')
      i++
      if (i >= steps.length) {
        clearInterval(tick)
        res.end()
      }
    }, 300)
  })
}
