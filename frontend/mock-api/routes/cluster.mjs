import { db } from '../data.mjs'

export function register(router) {
  router.add('GET', '/api/cluster/info', (_req, res) => {
    res.json(200, db.clusterInfo)
  })

  router.add('GET', '/api/cluster/workloads', (_req, res) => {
    res.json(200, db.workloads)
  })

  router.add('GET', '/api/cluster/nodes', (_req, res) => {
    res.json(200, db.nodes)
  })

  router.add('GET', '/api/cluster/nodes/:nodeName/pods', (req, res) => {
    const pods = db.pods.filter((p) => p.nodeName === req.params.nodeName)
    res.json(200, pods)
  })

  router.add('GET', '/api/cluster/pods/:namespace/:podName', (req, res) => {
    const key = `${req.params.namespace}/${req.params.podName}`
    const detail = db.podDetails[key]
    if (!detail) {
      // Generate a basic detail from the pod list
      const pod = db.pods.find((p) => p.namespace === req.params.namespace && p.name === req.params.podName)
      if (!pod) return res.json(404, { error: 'Pod not found' })
      return res.json(200, generatePodDetail(pod))
    }
    res.json(200, detail)
  })

  router.add('GET', '/api/cluster/pods/:namespace/:podName/logs', (req, res) => {
    const follow = req.query.follow === 'true'
    const tailLines = parseInt(req.query.tailLines ?? '100', 10)

    const logLines = generatePodLogLines(req.params.namespace, req.params.podName, tailLines)

    if (follow) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Transfer-Encoding': 'chunked' })
      res.write(logLines.join('\n') + '\n')

      const liveMsgs = [
        ['INFO ', 'Processing request POST /api/v1/resources'],
        ['INFO ', 'Health check passed — latency 3ms'],
        ['DEBUG', 'Cache miss for key session:abc — fetching from db'],
        ['INFO ', 'Request completed in 8ms — 200 OK'],
        ['INFO ', 'Request completed in 14ms — 200 OK'],
        ['INFO ', 'Request completed in 3ms — 304 Not Modified'],
        ['WARN ', 'Slow upstream response: 420ms from payment-svc'],
        ['INFO ', 'Scheduled task metrics.export executed'],
        ['ERROR', 'Connection to redis timed out after 5s'],
        ['INFO ', 'Reconnected to redis cluster (attempt 1)'],
        ['WARN ', 'Memory usage at 82% of limit'],
        ['INFO ', 'GC pause 2.1ms — heap 64MB/128MB'],
        ['DEBUG', 'Received message on channel events.workload (len=284)'],
        ['INFO ', 'Processing request GET /api/v1/namespaces/dev/pods'],
        ['INFO ', 'Serving static asset /assets/main.css (cache hit)'],
        ['DEBUG', 'SQL query: SELECT id, name FROM policies WHERE enabled = true (4 rows, 1.2ms)'],
        ['INFO ', 'WebSocket client connected from 10.244.1.12:48290'],
        ['WARN ', 'Retrying upstream request to inventory-svc (attempt 2/3)'],
        ['INFO ', 'Liveness probe succeeded — 200 OK in 1ms'],
        ['INFO ', 'Readiness probe succeeded — 200 OK in 2ms'],
        ['DEBUG', 'Token refresh: new expiry in 3599s'],
        ['INFO ', 'Batch write: 12 audit log entries flushed in 3ms'],
        ['INFO ', 'Request completed in 22ms — 201 Created'],
        ['WARN ', 'Connection pool at 85% capacity (17/20 active)'],
        ['ERROR', 'Upstream returned 503: payment-svc temporarily unavailable'],
        ['INFO ', 'Circuit breaker for payment-svc: open → half-open'],
        ['DEBUG', 'Cache set: key=user:456 ttl=300s size=1.2KB'],
        ['INFO ', 'Cron job cleanup.expired_sessions completed (removed 3)'],
        ['INFO ', 'TLS handshake completed with peer 10.244.2.8:443 in 12ms'],
        ['WARN ', 'DNS resolution for postgres.svc took 150ms (threshold: 100ms)'],
      ]
      let msgIdx = 0
      let timer = null
      function sendBurst() {
        const burstSize = 1 + Math.floor(Math.random() * 4)
        for (let i = 0; i < burstSize; i++) {
          const ts = new Date().toISOString()
          const [level, msg] = liveMsgs[msgIdx % liveMsgs.length]
          msgIdx++
          res.write(`${ts} ${level} [main] ${msg}\n`)
        }
        timer = setTimeout(sendBurst, 300 + Math.floor(Math.random() * 300))
      }
      timer = setTimeout(sendBurst, 200)

      req.on('close', () => clearTimeout(timer))
    } else {
      res.text(200, logLines.join('\n'))
    }
  })

  router.add('GET', '/api/cluster/workloads/:namespace/:kind/:name/pods', (req, res) => {
    const pods = db.pods.filter(
      (p) =>
        p.namespace === req.params.namespace &&
        p.ownerKind === req.params.kind &&
        p.ownerName === req.params.name,
    )
    res.json(200, pods)
  })

  // ── Overview (computed) ──────────────────────────────────────────────────

  router.add('GET', '/api/overview', (_req, res) => {
    res.json(200, computeOverview())
  })

  // ── SSE stream ───────────────────────────────────────────────────────────

  router.add('GET', '/api/cluster/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const send = () => {
      res.write(`data: ${JSON.stringify(computeOverview())}\n\n`)
    }

    send()
    const interval = setInterval(send, 5000)
    req.on('close', () => clearInterval(interval))
  })
}

function computeOverview() {
  const running = db.workloads.filter((w) => w.status === 'running').length
  const sleeping = db.workloads.filter((w) => w.status === 'sleeping').length
  const clusterStatus = sleeping === 0 ? 'awake' : running === 0 ? 'sleeping' : 'partial'

  const nsByCount = {}
  for (const w of db.workloads) {
    if (w.status === 'sleeping') nsByCount[w.namespace] = (nsByCount[w.namespace] || 0) + 1
  }
  const sleepingByNs = Object.entries(nsByCount).map(([namespace, count]) => ({ namespace, count }))

  const nextPolicy = db.policies
    .filter((p) => p.enabled && p.nextTransitionAt)
    .sort((a, b) => a.nextTransitionAt.localeCompare(b.nextTransitionAt))[0]

  return {
    clusterStatus,
    runningCount: running,
    sleepingCount: sleeping,
    nodeCount: db.nodes.length,
    sleepingByNs,
    nextRun: nextPolicy ? { name: nextPolicy.name, nextRun: nextPolicy.nextTransitionAt } : undefined,
    cacheAgeMs: 0,
  }
}

function generatePodDetail(pod) {
  const isHealthy = pod.status === 'Running' && pod.readyContainers > 0
  const isCrashing = pod.status === 'CrashLoopBackOff' || pod.status === 'Failed'
  const isPending = pod.status === 'Pending'

  const conditions = isPending
    ? [
        { type: 'Ready', status: 'False' }, { type: 'ContainersReady', status: 'False' },
        { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: isPending ? 'False' : 'True' },
      ]
    : isCrashing
      ? [
          { type: 'Ready', status: 'False' }, { type: 'ContainersReady', status: 'False' },
          { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: 'True' },
        ]
      : [
          { type: 'Ready', status: 'True' }, { type: 'ContainersReady', status: 'True' },
          { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: 'True' },
        ]

  const events = []
  if (!isPending) {
    events.push({ type: 'Normal', reason: 'Scheduled', message: `Successfully assigned ${pod.namespace}/${pod.name} to ${pod.nodeName ?? 'node-1'}`, count: 1, lastSeen: pod.startedAt })
    events.push({ type: 'Normal', reason: 'Started', message: `Started container ${pod.ownerName}`, count: isCrashing ? 5 : 1, lastSeen: pod.startedAt })
  }
  if (isPending) {
    events.push({ type: 'Warning', reason: 'FailedScheduling', message: 'Insufficient cpu: 0/4 nodes available', count: 3, lastSeen: pod.startedAt })
  }
  if (isCrashing) {
    events.push({ type: 'Warning', reason: 'BackOff', message: `Back-off restarting failed container ${pod.ownerName}`, count: 4, lastSeen: pod.startedAt })
  }

  return {
    name: pod.name,
    namespace: pod.namespace,
    phase: pod.status,
    nodeName: isPending ? '' : (pod.nodeName ?? 'node-1'),
    nodeInstanceType: isPending ? '' : 'm5.xlarge',
    podIP: isPending ? '' : `10.244.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    hostIP: isPending ? '' : '172.16.0.1',
    qosClass: 'Burstable',
    startedAt: pod.startedAt,
    labels: { app: pod.ownerName, 'app.kubernetes.io/name': pod.ownerName },
    annotations: {},
    containers: [
      {
        name: pod.ownerName,
        image: `ghcr.io/example/${pod.ownerName}:latest`,
        ready: isHealthy,
        restartCount: isCrashing ? 5 : 0,
        cpuRequest: pod.cpuRequest,
        memRequest: pod.memRequest,
        cpuLimit: pod.cpuRequest * 4,
        memLimit: pod.memRequest * 2,
        cpuUsage: pod.cpuUsage,
        memUsage: pod.memUsage,
        lastState: isCrashing ? 'OOMKilled' : '',
      },
    ],
    conditions,
    events,
  }
}

function generatePodLogLines(namespace, podName, count) {
  const weighted = [
    { level: 'INFO ', weight: 50 },
    { level: 'DEBUG', weight: 20 },
    { level: 'WARN ', weight: 15 },
    { level: 'ERROR', weight: 15 },
  ]
  const infoMsgs = [
    'Server started on :8080',
    'Connected to database pool (5 connections)',
    'Health check passed — latency 2ms',
    'Processing incoming request POST /api/v1/resources',
    'Request completed in 12ms — 200 OK',
    'Cache hit for key user:123 (ttl=300s)',
    'Scheduled task cron.cleanup executed',
    'Metrics exported to prometheus endpoint',
    'Connection pool: 5/20 active, 0 waiting',
    'GC pause 1.2ms — heap 48MB/128MB',
    'TLS certificate valid for 89 days',
    'Loaded 42 config entries from configmap',
  ]
  const warnMsgs = [
    'Slow query detected: SELECT * FROM events took 850ms',
    'Memory usage at 78% of limit (400Mi/512Mi)',
    'Connection pool near capacity: 18/20 active',
    'Deprecated API version v1beta1 called by client 10.244.1.5',
    'Rate limiter triggered for IP 192.168.1.100 (50 req/s)',
    'Certificate expires in 14 days — renewal recommended',
  ]
  const errorMsgs = [
    'Failed to connect to postgres:5432 — connection refused',
    'OOMKilled: container exceeded memory limit (512Mi)',
    'Panic recovered: runtime error: index out of range [3] with length 3',
    'CrashLoopBackOff: back-off 5m0s restarting failed container',
    'Liveness probe failed: HTTP probe failed with statuscode 503',
    'context deadline exceeded after 30s waiting for upstream',
  ]
  const lines = []
  const base = Date.now() - count * 1000
  let totalWeight = weighted.reduce((s, w) => s + w.weight, 0)
  for (let i = 0; i < count; i++) {
    const ts = new Date(base + i * 1000).toISOString()
    let r = Math.random() * totalWeight
    let level = 'INFO '
    for (const w of weighted) {
      r -= w.weight
      if (r <= 0) { level = w.level; break }
    }
    let msg
    if (level === 'ERROR') msg = errorMsgs[Math.floor(Math.random() * errorMsgs.length)]
    else if (level === 'WARN ') msg = warnMsgs[Math.floor(Math.random() * warnMsgs.length)]
    else msg = infoMsgs[Math.floor(Math.random() * infoMsgs.length)]
    lines.push(`${ts} ${level} [main] ${msg}`)
  }
  return lines
}
