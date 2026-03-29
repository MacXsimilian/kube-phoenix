import { db } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/audit-logs', (req, res) => {
    let items = [...db.auditLogs]

    // Filtering
    if (req.query.user) {
      const q = req.query.user.toLowerCase()
      items = items.filter((l) => l.username.toLowerCase().includes(q))
    }
    if (req.query.action) {
      items = items.filter((l) => l.action === req.query.action)
    }
    if (req.query.from) {
      items = items.filter((l) => l.timestamp >= req.query.from)
    }
    if (req.query.to) {
      items = items.filter((l) => l.timestamp <= req.query.to)
    }

    // Sort descending by timestamp
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    const total = items.length
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10))
    const pageSize = parseInt(req.query.pageSize ?? '20', 10)
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)

    res.json(200, { items, total })
  })
}
