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

      const interval = setInterval(() => {
        const ts = new Date().toISOString()
        res.write(`${ts} INFO  [main] Processing request ${Math.random().toString(36).slice(2, 8)}\n`)
      }, 2000)

      req.on('close', () => clearInterval(interval))
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
  return {
    name: pod.name,
    namespace: pod.namespace,
    phase: pod.status,
    nodeName: pod.nodeName ?? 'node-1',
    nodeInstanceType: 'm5.xlarge',
    podIP: `10.244.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    hostIP: '172.16.0.1',
    qosClass: 'Burstable',
    startedAt: pod.startedAt,
    labels: { app: pod.ownerName, 'app.kubernetes.io/name': pod.ownerName },
    annotations: {},
    containers: [
      {
        name: pod.ownerName,
        image: `ghcr.io/example/${pod.ownerName}:latest`,
        ready: pod.readyContainers > 0,
        restartCount: 0,
        cpuRequest: pod.cpuRequest,
        memRequest: pod.memRequest,
        cpuLimit: pod.cpuRequest * 4,
        memLimit: pod.memRequest * 2,
        cpuUsage: pod.cpuUsage,
        memUsage: pod.memUsage,
        lastState: '',
      },
    ],
    conditions: [
      { type: 'Ready', status: 'True' },
      { type: 'ContainersReady', status: 'True' },
      { type: 'Initialized', status: 'True' },
      { type: 'PodScheduled', status: 'True' },
    ],
    events: [
      { type: 'Normal', reason: 'Scheduled', message: `Successfully assigned ${pod.namespace}/${pod.name} to ${pod.nodeName ?? 'node-1'}`, count: 1, lastSeen: pod.startedAt },
      { type: 'Normal', reason: 'Started', message: `Started container ${pod.ownerName}`, count: 1, lastSeen: pod.startedAt },
    ],
  }
}

function generatePodLogLines(namespace, podName, count) {
  const levels = ['INFO ', 'DEBUG', 'INFO ', 'INFO ', 'WARN ']
  const messages = [
    'Server started on :8080',
    'Connected to database',
    'Health check passed',
    'Processing incoming request',
    'Request completed in 12ms',
    'Cache hit for key user:123',
    'Scheduled task executed',
    'Metrics exported successfully',
    'Connection pool: 5/20 active',
    'GC pause 1.2ms',
  ]
  const lines = []
  const base = Date.now() - count * 1000
  for (let i = 0; i < count; i++) {
    const ts = new Date(base + i * 1000).toISOString()
    const level = levels[i % levels.length]
    const msg = messages[i % messages.length]
    lines.push(`${ts} ${level} [main] ${msg}`)
  }
  return lines
}
