/**
 * Mock observability endpoints — SSE stream, historical snapshots, thresholds.
 * Generates realistic random-walk metric data matching the real backend's
 * ObservabilityStreamPayload shape.
 */

// ── Random walk helper ──────────────────────────────────────────────────────

function rw(prev, min, max, volatility) {
  const delta = (Math.random() - 0.48) * volatility
  return Math.max(min, Math.min(max, prev + delta))
}

// ── Threshold defaults ──────────────────────────────────────────────────────

const defaultThresholds = [
  { id: 1, panelKey: 'http_rate', warnVal: 150, critVal: 200 },
  { id: 2, panelKey: 'latency_p99', warnVal: 500, critVal: 1000 },
  { id: 3, panelKey: 'k8s_api', warnVal: 100, critVal: 120 },
  { id: 4, panelKey: 'ws_connections', warnVal: 50, critVal: 80 },
  { id: 5, panelKey: 'cache_hit', warnVal: 90, critVal: 70 },
  { id: 6, panelKey: 'error_rate', warnVal: 5, critVal: 15 },
  { id: 7, panelKey: 'scheduler_health', warnVal: 200, critVal: 500 },
  { id: 8, panelKey: 'policy_executions', warnVal: 5, critVal: 10 },
]

let thresholds = [...defaultThresholds]

// ── Metric state (random-walked each tick) ──────────────────────────────────

let state = {
  httpRequestRate: 120,
  httpLatencyP50Ms: 25,
  httpLatencyP95Ms: 85,
  httpLatencyP99Ms: 250,
  httpErrorRate: 1.2,
  k8sGetRate: 65,
  k8sPatchRate: 12,
  k8sDeleteRate: 3,
  policySuccessCount: 0,
  policyFailedCount: 0,
  policySkippedCount: 0,
  wsActiveConnections: 8,
  cacheHitRate: 95,
  schedulerEvalRate: 2,
  schedulerEvalDurationMs: 15,
  workloadsScaledCount: 0,
  scaleOperationDurationMs: 450,
  schedulerPanics: 0,
  auditDrops: 0,
  rateLimitHits: 0,
  totalErrorRate: 1.2,
}

// ── History ring buffer (stores last 3 days at 2s intervals) ────────────────

const HISTORY_MAX = 129_600 // 3 days × 24h × 60m × 30 ticks/min
const history = []

function tickState() {
  state.httpRequestRate = rw(state.httpRequestRate, 50, 220, 30)
  state.httpLatencyP50Ms = rw(state.httpLatencyP50Ms, 5, 100, 10)
  state.httpLatencyP95Ms = rw(state.httpLatencyP95Ms, 20, 400, 25)
  state.httpLatencyP99Ms = rw(state.httpLatencyP99Ms, 50, 800, 40)

  // Occasional P99 spike
  if (Math.random() < 0.03) {
    state.httpLatencyP99Ms = 550 + Math.random() * 200
  }

  state.httpErrorRate = rw(state.httpErrorRate, 0, 20, 2)
  state.k8sGetRate = rw(state.k8sGetRate, 10, 130, 15)
  state.k8sPatchRate = rw(state.k8sPatchRate, 0, 40, 5)
  state.k8sDeleteRate = rw(state.k8sDeleteRate, 0, 10, 2)

  // Policy executions — sparse events
  state.policySuccessCount = Math.random() < 0.1 ? Math.floor(Math.random() * 3) + 1 : 0
  state.policyFailedCount = Math.random() < 0.02 ? 1 : 0
  state.policySkippedCount = Math.random() < 0.05 ? 1 : 0

  state.wsActiveConnections = Math.round(rw(state.wsActiveConnections, 2, 25, 3))
  state.cacheHitRate = rw(state.cacheHitRate, 70, 100, 3)
  state.schedulerEvalRate = rw(state.schedulerEvalRate, 0.5, 5, 0.5)
  state.schedulerEvalDurationMs = rw(state.schedulerEvalDurationMs, 5, 100, 8)
  state.workloadsScaledCount = Math.random() < 0.15 ? Math.floor(Math.random() * 5) + 1 : 0
  state.scaleOperationDurationMs = rw(state.scaleOperationDurationMs, 100, 2000, 150)

  // Rare error events
  state.schedulerPanics = Math.random() < 0.005 ? 1 : 0
  state.auditDrops = Math.random() < 0.01 ? Math.floor(Math.random() * 3) + 1 : 0
  state.rateLimitHits = Math.random() < 0.03 ? Math.floor(Math.random() * 5) + 1 : 0

  // Error spike (4% chance)
  if (Math.random() < 0.04) {
    state.httpErrorRate = 6 + Math.random() * 6
  }
  state.totalErrorRate = state.httpErrorRate + (state.schedulerPanics > 0 ? 1 : 0)

  const snapshot = {
    id: history.length + 1,
    timestamp: new Date().toISOString(),
    ...state,
  }

  history.push(snapshot)
  if (history.length > HISTORY_MAX) history.shift()

  return snapshot
}

// ── Component & link metrics (derived from snapshot) ────────────────────────

function thresholdStatus(value, panelKey) {
  const t = thresholds.find((t) => t.panelKey === panelKey)
  if (!t) return 'ok'
  if (panelKey === 'cache_hit') {
    if (value < t.critVal) return 'crit'
    if (value < t.warnVal) return 'warn'
    return 'ok'
  }
  if (value >= t.critVal) return 'crit'
  if (value >= t.warnVal) return 'warn'
  return 'ok'
}

function buildComponents(s) {
  return [
    { component: 'router', rpsIn: s.httpRequestRate, rpsOut: s.httpRequestRate, latencyMs: s.httpLatencyP50Ms, errorRate: s.httpErrorRate, status: thresholdStatus(s.httpRequestRate, 'http_rate') },
    { component: 'auth', rpsIn: s.httpRequestRate, rpsOut: s.httpRequestRate * 0.98, latencyMs: 2, errorRate: 0, status: 'ok' },
    { component: 'handlers', rpsIn: s.httpRequestRate * 0.95, rpsOut: s.httpRequestRate * 0.90, latencyMs: s.httpLatencyP50Ms, errorRate: s.httpErrorRate, status: thresholdStatus(s.httpLatencyP99Ms, 'latency_p99') },
    { component: 'scheduler', rpsIn: s.schedulerEvalRate / 60, rpsOut: s.schedulerEvalRate / 60, latencyMs: s.schedulerEvalDurationMs, errorRate: s.schedulerPanics, status: thresholdStatus(s.schedulerEvalDurationMs, 'scheduler_health') },
    { component: 'scaler', rpsIn: s.workloadsScaledCount, rpsOut: s.k8sGetRate / 60 + s.k8sPatchRate / 60, latencyMs: s.scaleOperationDurationMs, errorRate: 0, status: 'ok' },
    { component: 'k8s-client', rpsIn: (s.k8sGetRate + s.k8sPatchRate + s.k8sDeleteRate) / 60, rpsOut: (s.k8sGetRate + s.k8sPatchRate + s.k8sDeleteRate) / 60, latencyMs: 50, errorRate: 0, status: thresholdStatus((s.k8sGetRate + s.k8sPatchRate + s.k8sDeleteRate) / 60, 'k8s_api') },
    { component: 'store', rpsIn: s.httpRequestRate * 0.6, rpsOut: s.httpRequestRate * 0.6, latencyMs: 5, errorRate: s.auditDrops, status: 'ok' },
    { component: 'ws-broker', rpsIn: s.wsActiveConnections, rpsOut: s.wsActiveConnections, latencyMs: 1, errorRate: 0, status: thresholdStatus(s.wsActiveConnections, 'ws_connections') },
  ]
}

function buildLinks(s) {
  return [
    { source: 'router', target: 'auth', rps: s.httpRequestRate, latencyMs: 2, errorRate: 0, category: 'http' },
    { source: 'auth', target: 'handlers', rps: s.httpRequestRate * 0.98, latencyMs: 1, errorRate: 0, category: 'http' },
    { source: 'handlers', target: 'scheduler', rps: s.schedulerEvalRate / 60, latencyMs: 1, errorRate: 0, category: 'internal' },
    { source: 'handlers', target: 'store', rps: s.httpRequestRate * 0.6, latencyMs: 5, errorRate: 0, category: 'store' },
    { source: 'handlers', target: 'ws-broker', rps: s.wsActiveConnections * 0.1, latencyMs: 1, errorRate: 0, category: 'ws' },
    { source: 'scheduler', target: 'scaler', rps: s.workloadsScaledCount * 0.5, latencyMs: s.schedulerEvalDurationMs, errorRate: 0, category: 'internal' },
    { source: 'scaler', target: 'k8s-client', rps: (s.k8sPatchRate + s.k8sDeleteRate) / 60, latencyMs: 50, errorRate: 0, category: 'k8s' },
    { source: 'k8s-client', target: 'store', rps: s.k8sGetRate / 60 * 0.3, latencyMs: 5, errorRate: 0, category: 'store' },
    { source: 'scheduler', target: 'ws-broker', rps: s.schedulerEvalRate / 60 * 0.5, latencyMs: 1, errorRate: 0, category: 'ws' },
    { source: 'ws-broker', target: 'handlers', rps: s.wsActiveConnections * 0.05, latencyMs: 1, errorRate: 0, category: 'ws' },
  ]
}

// ── Live API call generation ────────────────────────────────────────────────

let callSeq = 0

const API_CALL_TEMPLATES = [
  { method: 'GET',    path: '/api/policies',                  component: 'handlers',  goFunc: 'h.listPolicies',            category: 'http',     baseMs: 8 },
  { method: 'GET',    path: '/api/policies/{id}',             component: 'handlers',  goFunc: 'h.getPolicy',               category: 'http',     baseMs: 5 },
  { method: 'GET',    path: '/api/overview',                  component: 'handlers',  goFunc: 'h.getOverview',             category: 'http',     baseMs: 12 },
  { method: 'GET',    path: '/api/cluster/workloads',         component: 'handlers',  goFunc: 'h.getWorkloads',            category: 'http',     baseMs: 18 },
  { method: 'GET',    path: '/api/cluster/nodes',             component: 'handlers',  goFunc: 'h.getNodes',                category: 'http',     baseMs: 15 },
  { method: 'GET',    path: '/api/audit-logs',                component: 'handlers',  goFunc: 'h.listAuditLogs',           category: 'http',     baseMs: 22 },
  { method: 'GET',    path: '/api/policy-executions',         component: 'handlers',  goFunc: 'h.listPolicyExecutions',    category: 'http',     baseMs: 14 },
  { method: 'GET',    path: '/api/exceptions',                component: 'handlers',  goFunc: 'h.listExceptions',          category: 'http',     baseMs: 6 },
  { method: 'GET',    path: '/api/guardrails',                component: 'handlers',  goFunc: 'h.getGuardrails',           category: 'http',     baseMs: 3 },
  { method: 'GET',    path: '/api/auth/me',                   component: 'auth',      goFunc: 'h.me',                      category: 'http',     baseMs: 2 },
  { method: 'POST',   path: '/api/policies/{id}/sleep',       component: 'handlers',  goFunc: 'h.triggerPolicySleep',      category: 'http',     baseMs: 45 },
  { method: 'POST',   path: '/api/policies/{id}/wake',        component: 'handlers',  goFunc: 'h.triggerPolicyWake',       category: 'http',     baseMs: 40 },
  { method: 'PUT',    path: '/api/guardrails',                component: 'handlers',  goFunc: 'h.updateGuardrails',        category: 'http',     baseMs: 8 },
  { method: 'SSE',    path: '/api/cluster/stream',            component: 'handlers',  goFunc: 'h.streamCluster',           category: 'http',     baseMs: 0 },
  { method: 'SSE',    path: '/api/observability/stream',      component: 'handlers',  goFunc: 'h.streamObservability',     category: 'http',     baseMs: 0 },
  { method: 'WS',     path: '/ws/policy-executions/{id}/logs',component: 'ws-broker', goFunc: 'h.wsPolicyExecutionLogs',   category: 'ws',       baseMs: 1 },
  { method: 'GET',    path: 'k8s:apps/v1/deployments',       component: 'k8s-client',goFunc: 'clientset.AppsV1().List',    category: 'k8s',      baseMs: 35 },
  { method: 'PATCH',  path: 'k8s:apps/v1/deployments/scale',  component: 'k8s-client',goFunc: 'clientset.AppsV1().UpdateScale', category: 'k8s', baseMs: 50 },
  { method: 'GET',    path: 'k8s:v1/pods',                   component: 'k8s-client',goFunc: 'clientset.CoreV1().List',    category: 'k8s',      baseMs: 28 },
  { method: 'GET',    path: 'k8s:v1/nodes',                  component: 'k8s-client',goFunc: 'clientset.CoreV1().List',    category: 'k8s',      baseMs: 20 },
  { method: 'DELETE', path: 'k8s:v1/nodes/{name}',           component: 'k8s-client',goFunc: 'clientset.CoreV1().Delete',  category: 'k8s',      baseMs: 80 },
  { method: 'GET',    path: 'db:SELECT * FROM policies',     component: 'store',     goFunc: 'store.ListPolicies',         category: 'store',    baseMs: 4 },
  { method: 'GET',    path: 'db:SELECT * FROM policy_executions', component: 'store', goFunc: 'store.ListExecutions',      category: 'store',    baseMs: 6 },
  { method: 'POST',   path: 'db:INSERT INTO audit_logs',     component: 'store',     goFunc: 'store.CreateAuditLog',       category: 'store',    baseMs: 3 },
  { method: 'POST',   path: 'db:INSERT INTO workload_snapshots', component: 'store', goFunc: 'store.CreateSnapshot',       category: 'store',    baseMs: 5 },
  { method: 'GET',    path: 'db:SELECT * FROM users',        component: 'store',     goFunc: 'store.ListUsers',            category: 'store',    baseMs: 3 },
  { method: 'GET',    path: 'scheduler:evaluate',            component: 'scheduler', goFunc: 'scheduler.evaluatePolicies', category: 'internal', baseMs: 15 },
  { method: 'POST',   path: 'scheduler:runSleepNow',         component: 'scheduler', goFunc: 'scheduler.RunSleepNow',     category: 'internal', baseMs: 200 },
  { method: 'POST',   path: 'scaler:scaleDeployment',        component: 'scaler',    goFunc: 'scaler.ScaleDeployment',     category: 'internal', baseMs: 120 },
  { method: 'POST',   path: 'broker:publish',                component: 'ws-broker', goFunc: 'broker.Publish',             category: 'ws',       baseMs: 1 },
]

// Weight tables: high-frequency calls appear more often
const CALL_WEIGHTS = [
  { range: [0, 9],   weight: 60 },   // GET reads — very frequent
  { range: [10, 12], weight: 3 },     // POST/PUT mutations — rare
  { range: [13, 14], weight: 2 },     // SSE — very rare (long-lived)
  { range: [15, 15], weight: 4 },     // WS
  { range: [16, 20], weight: 25 },    // K8s calls
  { range: [21, 25], weight: 30 },    // DB queries
  { range: [26, 26], weight: 15 },    // Scheduler eval — every 30s tick
  { range: [27, 29], weight: 5 },     // Internal calls — sparse
]

function pickCallTemplate() {
  const totalWeight = CALL_WEIGHTS.reduce((s, w) => s + w.weight, 0)
  let r = Math.random() * totalWeight
  for (const { range, weight } of CALL_WEIGHTS) {
    r -= weight
    if (r <= 0) {
      const idx = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))
      return API_CALL_TEMPLATES[idx]
    }
  }
  return API_CALL_TEMPLATES[0]
}

function generateCalls(count) {
  const calls = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const tmpl = pickCallTemplate()
    const jitter = tmpl.baseMs * (0.5 + Math.random() * 1.5)
    const durationMs = Math.round(jitter * 10) / 10
    const isError = Math.random() < 0.02
    calls.push({
      id: `call-${++callSeq}`,
      timestamp: new Date(now - Math.random() * 2000).toISOString(),
      method: tmpl.method,
      path: tmpl.path,
      statusCode: isError ? (tmpl.category === 'k8s' ? 409 : tmpl.category === 'store' ? 500 : 503) : 200,
      durationMs,
      component: tmpl.component,
      goFunc: tmpl.goFunc,
      category: tmpl.category,
    })
  }
  return calls.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function buildPayload(snapshot) {
  const callCount = 3 + Math.floor(Math.random() * 5)
  return {
    snapshot,
    components: buildComponents(snapshot),
    links: buildLinks(snapshot),
    thresholds,
    recentCalls: generateCalls(callCount),
  }
}

// ── Pre-seed ~60 seconds of history so the dashboard isn't empty on load ────

for (let i = 0; i < 30; i++) tickState()

// ── Route registration ──────────────────────────────────────────────────────

export function register(router) {
  // SSE stream — real-time metric updates every 2s
  router.add('GET', '/api/observability/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const send = () => {
      const snapshot = tickState()
      const payload = buildPayload(snapshot)
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    send()
    const interval = setInterval(send, 2000)
    req.on('close', () => clearInterval(interval))
  })

  // Historical snapshots — supports ?range=1h or ?from=...&to=...
  router.add('GET', '/api/observability/history', (req, res) => {
    let from, to

    if (req.query.range) {
      to = new Date()
      from = new Date(to.getTime() - parseDuration(req.query.range))
    } else if (req.query.from && req.query.to) {
      from = new Date(req.query.from)
      to = new Date(req.query.to)
    } else {
      from = new Date(Date.now() - 60_000)
      to = new Date()
    }

    const filtered = history.filter((s) => {
      const t = new Date(s.timestamp).getTime()
      return t >= from.getTime() && t <= to.getTime()
    })

    // Downsample for longer ranges
    const duration = to.getTime() - from.getTime()
    const maxPoints = maxPointsForRange(duration)
    const result = downsample(filtered, maxPoints)

    res.json(200, result)
  })

  // Thresholds — GET all
  router.add('GET', '/api/observability/thresholds', (_req, res) => {
    res.json(200, thresholds)
  })

  // Thresholds — PUT upsert
  router.add('PUT', '/api/observability/thresholds', (req, res) => {
    const body = req.body
    if (!body || !body.panelKey) {
      return res.json(400, { error: 'panelKey is required' })
    }
    const idx = thresholds.findIndex((t) => t.panelKey === body.panelKey)
    if (idx >= 0) {
      thresholds[idx] = { ...thresholds[idx], ...body }
      res.json(200, thresholds[idx])
    } else {
      const newT = { id: thresholds.length + 1, ...body }
      thresholds.push(newT)
      res.json(200, newT)
    }
  })

  // Runtime config — component limits
  router.add('GET', '/api/observability/config', (_req, res) => {
    res.json(200, {
      components: {
        chi:          [{ label: 'Max body', value: '1 MB' }],
        auth:         [{ label: 'Rate limit (IP)', value: '10 req / 15m0s' }, { label: 'Rate limit (user)', value: '5 req / 15m0s' }],
        'k8s-client': [{ label: 'QPS', value: '100' }, { label: 'Burst', value: '200' }],
        store:        [{ label: 'Pool size', value: '10' }, { label: 'Idle conns', value: '5' }, { label: 'Conn lifetime', value: '5m0s' }],
        cache:        [{ label: 'Resync', value: '5m' }, { label: 'Max subscribers', value: '100' }],
        broker:       [{ label: 'Channel buffer', value: '256' }],
        audit:        [{ label: 'Write buffer', value: '4096' }],
        scheduler:    [{ label: 'Tick interval', value: '30s' }],
        postgres:     [{ label: 'Tables', value: '11' }],
      },
    })
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDuration(s) {
  const num = parseInt(s, 10)
  if (s.endsWith('d')) return num * 86_400_000
  if (s.endsWith('h')) return num * 3_600_000
  if (s.endsWith('m')) return num * 60_000
  if (s.endsWith('s')) return num * 1_000
  return num
}

function maxPointsForRange(durationMs) {
  if (durationMs <= 60_000) return 60
  if (durationMs <= 300_000) return 300
  if (durationMs <= 900_000) return 300
  if (durationMs <= 3_600_000) return 240
  if (durationMs <= 21_600_000) return 360
  if (durationMs <= 86_400_000) return 1440
  return 864
}

function downsample(rows, targetCount) {
  if (rows.length <= targetCount || targetCount <= 0) return rows
  const bucketSize = Math.floor(rows.length / targetCount)
  if (bucketSize < 2) return rows
  const result = []
  for (let i = 0; i < rows.length; i += bucketSize) {
    const bucket = rows.slice(i, Math.min(i + bucketSize, rows.length))
    result.push(averageBucket(bucket))
  }
  return result
}

function averageBucket(bucket) {
  const n = bucket.length
  const avg = { ...bucket[Math.floor(n / 2)] }
  const numericKeys = [
    'httpRequestRate', 'httpLatencyP50Ms', 'httpLatencyP95Ms', 'httpLatencyP99Ms',
    'httpErrorRate', 'k8sGetRate', 'k8sPatchRate', 'k8sDeleteRate',
    'wsActiveConnections', 'cacheHitRate', 'schedulerEvalRate', 'schedulerEvalDurationMs',
    'scaleOperationDurationMs', 'totalErrorRate',
  ]
  for (const key of numericKeys) {
    const sum = bucket.reduce((s, row) => s + (row[key] ?? 0), 0)
    avg[key] = sum / n
  }
  return avg
}
