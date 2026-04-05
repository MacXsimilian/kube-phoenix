/**
 * In-memory seed data store for the mock API.
 * All entities are cross-referenced by ID.
 */

const now = new Date()
const iso = (d) => d.toISOString()
const ago = (hours) => iso(new Date(now.getTime() - hours * 3600_000))
const future = (hours) => iso(new Date(now.getTime() + hours * 3600_000))

function createSeedData() {
  return {
    _seq: {
      policy: 4,
      user: 6,
      execution: 9,
      logLine: 70,
      exception: 7,
      audit: 25,
      session: 3,
    },

    // ── Auth / current user ──────────────────────────────────────────────────
    currentUser: {
      id: 1, username: 'admin', givenName: 'Max', familyName: 'Mustermann',
      email: 'admin@example.com', role: 'admin', source: 'local', enabled: true,
      createdAt: ago(720), lastLoginAt: ago(1),
      defaultTimezone: 'Europe/Berlin',
      permissions: [
        'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit',
        'user.manage', 'admin.reset_db', 'admin.emergency_scale', 'audit.view', 'password.change',
      ],
    },

    users: [
      {
        id: 1, username: 'admin', givenName: 'Max', familyName: 'Mustermann',
        email: 'admin@example.com', role: 'admin', source: 'local', enabled: true,
        createdAt: ago(720), lastLoginAt: ago(1),
        permissions: ['view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'user.manage', 'admin.reset_db', 'admin.emergency_scale', 'audit.view', 'password.change'],
      },
      {
        id: 2, username: 'operator1', givenName: 'Sarah', familyName: 'Chen',
        email: 'sarah@example.com', role: 'operator', source: 'local', enabled: true,
        createdAt: ago(480), lastLoginAt: ago(12),
        permissions: ['view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'audit.view', 'password.change'],
      },
      {
        id: 3, username: 'viewer1', givenName: 'Tom', familyName: 'Johnson',
        email: 'tom@example.com', role: 'viewer', source: 'local', enabled: true,
        createdAt: ago(240), lastLoginAt: ago(48),
        permissions: ['view.all', 'password.change'],
      },
      {
        id: 4, username: 'jane.doe', givenName: 'Jane', familyName: 'Doe',
        email: 'jane@example.com', role: 'operator', source: 'oidc', enabled: true,
        createdAt: ago(168), lastLoginAt: ago(24),
        permissions: ['view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'audit.view'],
      },
      {
        id: 5, username: 'disabled-user', givenName: 'Old', familyName: 'Account',
        email: 'old@example.com', role: 'viewer', source: 'local', enabled: false,
        createdAt: ago(2160), lastLoginAt: ago(720),
        permissions: [],
      },
    ],

    sessions: [
      { id: 1, ipAddress: '192.168.1.42', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', createdAt: ago(2), expiresAt: future(6), isCurrent: true },
      { id: 2, ipAddress: '10.0.0.5', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', createdAt: ago(26), expiresAt: ago(2), isCurrent: false },
    ],

    oidcConfig: {
      enabled: true, mounted: true,
      issuerURL: 'https://auth.example.com',
      clientID: 'kube-phoenix-prod',
      redirectURL: 'https://phoenix.example.com/callback',
      groupsClaim: 'groups',
      roleAdminGroups: ['platform-admins'],
      roleOperatorGroups: ['platform-operators', 'sre-team'],
    },

    // ── Guardrails ───────────────────────────────────────────────────────────
    guardrails: {
      id: 1,
      systemNamespaces: 'kube-system,kube-node-lease',
      skipNsNode: '',
      skipNodeLabels: '',
      skipNodeTaints: '',
      scalingPriorityNamespaces: '',
      schedulerEvalInterval: '30s',
      schedulerAutoWake: true,
      schedulerReconcileWhileAwake: true,
      scalingConcurrency: 5,
      wakeWaveSize: 0,
      wakeWavePauseSeconds: 90,
      schedulerEnforceSleep: true,
      protectCriticalPodNodes: true,
      updatedAt: ago(48),
    },

    // ── Policies ─────────────────────────────────────────────────────────────
    policies: [
      {
        id: 1, name: 'EU Dev Sleep', description: 'Scale down EU dev workloads outside business hours',
        namespaceFilter: 'dev,dev-*', labelSelector: '',
        sleepWindows: [
          { name: 'Weeknight', daysOfWeek: [1, 2, 3, 4, 5], startTime: '20:00', endTime: '07:00', allDay: false },
          { name: 'Weekend', daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
        ],
        timezone: 'Europe/Berlin', mode: 'apply', enabled: true, timeoutMinutes: 15,
        currentState: 'transitioning', stateSince: ago(0.05), lastSleepAt: ago(34), lastWakeAt: ago(10),
        createdAt: ago(720), updatedAt: ago(48), nextTransitionAt: future(8),
      },
      {
        id: 2, name: 'US Staging Nightly', description: 'Sleep staging environment overnight US time',
        namespaceFilter: 'staging,staging-*', labelSelector: '',
        sleepWindows: [
          { name: 'Nightly', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '22:00', endTime: '06:00', allDay: false },
        ],
        timezone: 'America/New_York', mode: 'apply', enabled: true, timeoutMinutes: 10,
        currentState: 'sleeping', stateSince: ago(6), lastSleepAt: ago(6), lastWakeAt: ago(18),
        createdAt: ago(480), updatedAt: ago(72), nextTransitionAt: future(2),
      },
      {
        id: 3, name: 'Cost Optimization (Plan Only)', description: 'Dry-run policy for monitoring namespace to estimate savings',
        namespaceFilter: 'monitoring', labelSelector: 'cost-tier=standard',
        sleepWindows: [
          { name: 'Off-peak', daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '08:00', allDay: false },
        ],
        timezone: 'UTC', mode: 'plan', enabled: false, timeoutMinutes: 5,
        currentState: 'awake', stateSince: ago(168), lastSleepAt: null, lastWakeAt: null,
        createdAt: ago(168), updatedAt: ago(168), nextTransitionAt: null,
      },
    ],

    // ── Executions ───────────────────────────────────────────────────────────
    executions: [
      { id: 1, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(58), finishedAt: ago(57.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 1, countDeleted: 0 },
      { id: 2, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(46), finishedAt: ago(45.9), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 3, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(30), finishedAt: ago(29.7), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 1, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 4, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(18), finishedAt: ago(17.9), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 5, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(34), finishedAt: ago(33.7), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 1, countDeleted: 0 },
      { id: 6, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(6), finishedAt: ago(5.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 7, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'wake', trigger: 'manual', startedAt: ago(10), finishedAt: ago(9.9), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 8, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(0.05), finishedAt: null, status: 'running', mode: 'apply', countScaled: 2, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0, progress: 0.55, currentPhase: 'Scaling' },
    ],

    // ── Log lines (per execution) ────────────────────────────────────────────
    logLines: [
      // Execution 1 (sleep)
      { id: 1, executionId: 1, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "dev,dev-*"  label selector: ""', timestamp: ago(58) },
      { id: 2, executionId: 1, seq: 2, level: 'info', message: 'Found 4 matching workloads in namespace dev', timestamp: ago(57.99) },
      { id: 200, executionId: 1, seq: 3, level: 'info', message: 'Estimate: sleep 4 workloads → ~8 K8s API calls with concurrency 2', timestamp: ago(57.98) },
      { id: 3, executionId: 1, seq: 4, level: 'ok', message: 'Slept Deployment dev/api-server (was 3 replicas)', timestamp: ago(57.95) },
      { id: 4, executionId: 1, seq: 5, level: 'ok', message: 'Slept Deployment dev/web-frontend (was 2 replicas)', timestamp: ago(57.92) },
      { id: 5, executionId: 1, seq: 6, level: 'ok', message: 'Slept StatefulSet dev/redis (was 1 replicas)', timestamp: ago(57.9) },
      { id: 6, executionId: 1, seq: 7, level: 'ok', message: 'Slept Deployment dev/worker (was 2 replicas)', timestamp: ago(57.88) },
      { id: 7, executionId: 1, seq: 8, level: 'info', message: 'Draining node node-3 (pods=0 timeout=60s)...', timestamp: ago(57.85) },
      { id: 201, executionId: 1, seq: 9, level: 'ok', message: 'Drained node node-3', timestamp: ago(57.83) },
      { id: 8, executionId: 1, seq: 10, level: 'ok', message: 'Sleep complete in 3.2s — scaled 4 workloads, 0 skipped, 0 errors, 8 K8s API calls (2.5 req/s)', timestamp: ago(57.8) },
      // Execution 2 (wake)
      { id: 9, executionId: 2, seq: 1, level: 'info', message: 'Policy wake — restoring 4 snapshotted workloads (namespace filter: "")', timestamp: ago(46) },
      { id: 10, executionId: 2, seq: 2, level: 'ok', message: 'Restored Deployment dev/api-server → 3 replicas', timestamp: ago(45.98) },
      { id: 11, executionId: 2, seq: 3, level: 'ok', message: 'Restored Deployment dev/web-frontend → 2 replicas', timestamp: ago(45.95) },
      { id: 12, executionId: 2, seq: 4, level: 'ok', message: 'Restored StatefulSet dev/redis → 1 replicas', timestamp: ago(45.93) },
      { id: 13, executionId: 2, seq: 5, level: 'ok', message: 'Restored Deployment dev/worker → 2 replicas', timestamp: ago(45.91) },
      { id: 14, executionId: 2, seq: 6, level: 'ok', message: 'Wake complete in 2.8s — scaled 4 workloads, 0 skipped, 0 errors, 4 K8s API calls (1.4 req/s)', timestamp: ago(45.9) },
      // Execution 3 (sleep staging)
      { id: 15, executionId: 3, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "staging"  label selector: ""', timestamp: ago(30) },
      { id: 16, executionId: 3, seq: 2, level: 'info', message: 'Found 5 matching workloads in namespace staging', timestamp: ago(29.98) },
      { id: 202, executionId: 3, seq: 3, level: 'info', message: 'Estimate: sleep 5 workloads → ~10 K8s API calls with concurrency 2', timestamp: ago(29.97) },
      { id: 17, executionId: 3, seq: 4, level: 'ok', message: 'Slept Deployment staging/checkout-svc (was 2 replicas)', timestamp: ago(29.95) },
      { id: 18, executionId: 3, seq: 5, level: 'ok', message: 'Slept Deployment staging/product-api (was 3 replicas)', timestamp: ago(29.9) },
      { id: 19, executionId: 3, seq: 6, level: 'ok', message: 'Slept Deployment staging/cart-svc (was 2 replicas)', timestamp: ago(29.85) },
      { id: 20, executionId: 3, seq: 7, level: 'ok', message: 'Slept StatefulSet staging/postgres (was 1 replicas)', timestamp: ago(29.8) },
      { id: 21, executionId: 3, seq: 8, level: 'info', message: 'Already at 0 replicas: Deployment staging/migrations-job (snapshotted, not scaled)', timestamp: ago(29.75) },
      { id: 22, executionId: 3, seq: 9, level: 'ok', message: 'Sleep complete in 3.5s — scaled 4 workloads, 1 skipped, 0 errors, 8 K8s API calls (2.3 req/s)', timestamp: ago(29.7) },
      // Execution 6 (latest sleep staging)
      { id: 40, executionId: 6, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "staging"  label selector: ""', timestamp: ago(6) },
      { id: 41, executionId: 6, seq: 2, level: 'info', message: 'Found 4 matching workloads in namespace staging', timestamp: ago(5.98) },
      { id: 203, executionId: 6, seq: 3, level: 'info', message: 'Estimate: sleep 4 workloads → ~8 K8s API calls with concurrency 2', timestamp: ago(5.97) },
      { id: 42, executionId: 6, seq: 4, level: 'ok', message: 'Slept Deployment staging/checkout-svc (was 2 replicas)', timestamp: ago(5.95) },
      { id: 43, executionId: 6, seq: 5, level: 'ok', message: 'Slept Deployment staging/product-api (was 3 replicas)', timestamp: ago(5.9) },
      { id: 44, executionId: 6, seq: 6, level: 'ok', message: 'Slept Deployment staging/cart-svc (was 2 replicas)', timestamp: ago(5.85) },
      { id: 45, executionId: 6, seq: 7, level: 'ok', message: 'Slept StatefulSet staging/postgres (was 1 replicas)', timestamp: ago(5.82) },
      { id: 46, executionId: 6, seq: 8, level: 'ok', message: 'Sleep complete in 2.9s — scaled 4 workloads, 0 skipped, 0 errors, 8 K8s API calls (2.8 req/s)', timestamp: ago(5.8) },
      // Execution 8 (running) — log lines generated dynamically by WebSocket handler
    ],

    // ── Workload snapshots ───────────────────────────────────────────────────
    snapshots: [
      { id: 1, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'api-server', replicasBefore: 3, replicasRestored: 3, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 2, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'web-frontend', replicasBefore: 2, replicasRestored: 2, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 3, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'StatefulSet', name: 'redis', replicasBefore: 1, replicasRestored: 1, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 4, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'worker', replicasBefore: 2, replicasRestored: 2, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 5, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'checkout-svc', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 6, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'product-api', replicasBefore: 3, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
    ],


    // ── Scheduled exceptions ─────────────────────────────────────────────────
    exceptions: [
      {
        id: 1, policyId: 1, exceptionType: 'stay_awake',
        startsAt: future(24), endsAt: future(48), ticketRef: 'OPS-1234',
        reason: 'Black Friday traffic test', sleepOnEnd: true,
        namespaceFilter: 'dev', labelSelector: '', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'admin',
        createdAt: ago(12), updatedAt: ago(12), workloadTargets: [],
      },
      {
        id: 2, policyId: 2, exceptionType: 'stay_awake',
        startsAt: ago(4), endsAt: future(8), ticketRef: 'STAGING-99',
        reason: 'QA regression suite running', sleepOnEnd: false,
        namespaceFilter: 'staging', labelSelector: '', status: 'active',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'operator1',
        createdAt: ago(6), updatedAt: ago(4), workloadTargets: [],
      },
      {
        id: 3, policyId: 1, exceptionType: 'force_sleep',
        startsAt: ago(72), endsAt: ago(48), ticketRef: 'COST-42',
        reason: 'Emergency cost reduction', sleepOnEnd: false,
        namespaceFilter: 'dev', labelSelector: '', status: 'completed',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'admin',
        createdAt: ago(80), updatedAt: ago(48),
        workloadTargets: [
          { kind: 'Deployment', namespace: 'dev', name: 'api-server' },
          { kind: 'Deployment', namespace: 'dev', name: 'web-frontend' },
        ],
      },
      {
        id: 4, policyId: 2, exceptionType: 'stay_awake',
        startsAt: future(168), endsAt: future(192), ticketRef: 'REL-2024-Q1',
        reason: 'Release weekend — keep staging awake for rollback window', sleepOnEnd: true,
        namespaceFilter: 'staging', labelSelector: 'team=platform', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'operator1',
        createdAt: ago(2), updatedAt: ago(2),
        workloadTargets: [
          { kind: 'Deployment', namespace: 'staging', name: 'checkout-svc' },
          { kind: 'Deployment', namespace: 'staging', name: 'product-api' },
          { kind: 'StatefulSet', namespace: 'staging', name: 'postgres' },
        ],
      },
      {
        id: 5, policyId: 1, exceptionType: 'force_sleep',
        startsAt: future(240), endsAt: future(288), ticketRef: 'COST-51',
        reason: 'Planned cost saving — dev environments offline over long weekend', sleepOnEnd: false,
        namespaceFilter: 'dev', labelSelector: '', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'admin',
        createdAt: ago(1), updatedAt: ago(1), workloadTargets: [],
      },
      {
        id: 6, policyId: 1, exceptionType: 'stay_awake',
        startsAt: '2026-04-02T08:00:00Z', endsAt: '2026-04-02T20:00:00Z', ticketRef: 'DEMO-77',
        reason: 'Customer demo — keep dev awake during business hours', sleepOnEnd: true,
        namespaceFilter: 'dev', labelSelector: '', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'operator1',
        createdAt: ago(1), updatedAt: ago(1), workloadTargets: [],
      },
    ],

    // ── Workloads ────────────────────────────────────────────────────────────
    workloads: [
      // dev namespace — currently awake
      { namespace: 'dev', name: 'api-server', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },
      { namespace: 'dev', name: 'web-frontend', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'dev', name: 'redis', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'dev', name: 'worker', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      // staging namespace — currently sleeping
      { namespace: 'staging', name: 'checkout-svc', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'product-api', kind: 'Deployment', currentReplicas: 0, savedReplicas: 3, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'cart-svc', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'postgres', kind: 'StatefulSet', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },
      // dev namespace — one unhealthy workload (CrashLoopBackOff pod)
      { namespace: 'dev', name: 'event-processor', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 1, status: 'partial' },
      // kube-system namespace — system-protected
      { namespace: 'kube-system', name: 'coredns', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'kube-system', name: 'kube-proxy', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },
      // monitoring namespace — always running
      { namespace: 'monitoring', name: 'prometheus', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'grafana', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'alertmanager', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'loki', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
    ],

    // ── Nodes ────────────────────────────────────────────────────────────────
    nodes: [
      {
        name: 'node-1', instanceType: 'm5.xlarge', zone: 'eu-west-1a', podCount: 12,
        status: 'active', protectionReason: null,
        cpuAllocatable: 4000, cpuRequested: 2800, memAllocatable: 16_000_000_000, memRequested: 10_500_000_000,
        createdAt: ago(2160), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.xlarge', 'topology.kubernetes.io/zone': 'eu-west-1a' },
        taints: [],
      },
      {
        name: 'node-2', instanceType: 'm5.xlarge', zone: 'eu-west-1b', podCount: 8,
        status: 'protected', protectionReason: 'Hosts kube-system critical pods',
        cpuAllocatable: 4000, cpuRequested: 1900, memAllocatable: 16_000_000_000, memRequested: 8_200_000_000,
        createdAt: ago(2160), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.xlarge', 'topology.kubernetes.io/zone': 'eu-west-1b' },
        taints: [],
      },
      {
        name: 'node-3', instanceType: 'm5.large', zone: 'eu-west-1a', podCount: 3,
        status: 'would-drain', protectionReason: null,
        cpuAllocatable: 2000, cpuRequested: 400, memAllocatable: 8_000_000_000, memRequested: 1_200_000_000,
        createdAt: ago(720), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.large', 'topology.kubernetes.io/zone': 'eu-west-1a' },
        taints: [],
      },
      {
        name: 'node-4', instanceType: 'm5.large', zone: 'eu-west-1c', podCount: 0,
        status: 'active', protectionReason: null,
        cpuAllocatable: 2000, cpuRequested: 0, memAllocatable: 8_000_000_000, memRequested: 0,
        createdAt: ago(48), cordoned: true,
        labels: { 'node.kubernetes.io/instance-type': 'm5.large', 'topology.kubernetes.io/zone': 'eu-west-1c' },
        taints: [{ key: 'node.kubernetes.io/unschedulable', value: '', effect: 'NoSchedule' }],
      },
    ],

    // ── Pods (flat list, keyed by node for node-pods, by owner for workload-pods) ─
    pods: [
      // node-1 pods (dev workloads)
      { name: 'api-server-7f8b9c-x2k4q', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 180, memUsage: 380_000_000, startedAt: ago(10) },
      { name: 'api-server-7f8b9c-m9p2j', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 140, memUsage: 350_000_000, startedAt: ago(10) },
      { name: 'api-server-7f8b9c-q4r7w', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 160, memUsage: 370_000_000, startedAt: ago(10) },
      { name: 'web-frontend-5c4d3e-h8j2k', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 60, memUsage: 180_000_000, startedAt: ago(10) },
      { name: 'web-frontend-5c4d3e-p3n6f', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 55, memUsage: 170_000_000, startedAt: ago(10) },
      { name: 'redis-0', namespace: 'dev', ownerKind: 'StatefulSet', ownerName: 'redis', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 50, memUsage: 650_000_000, startedAt: ago(168) },
      { name: 'worker-6a5b4c-d2e8f', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 120, memUsage: 400_000_000, startedAt: ago(10) },
      { name: 'worker-6a5b4c-g7h3i', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 90, memUsage: 380_000_000, startedAt: ago(10) },
      // node-2 also has monitoring
      { name: 'prometheus-0', namespace: 'monitoring', ownerKind: 'StatefulSet', ownerName: 'prometheus', nodeName: 'node-2', status: 'Running', readyContainers: 2, totalContainers: 2, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 350, memUsage: 1_800_000_000, startedAt: ago(720) },
      { name: 'grafana-8d7e6f-k4l2m', namespace: 'monitoring', ownerKind: 'Deployment', ownerName: 'grafana', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 80, memUsage: 300_000_000, startedAt: ago(720) },
      { name: 'alertmanager-9c8d7e-n5o3p', namespace: 'monitoring', ownerKind: 'Deployment', ownerName: 'alertmanager', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 20, memUsage: 120_000_000, startedAt: ago(720) },
      { name: 'loki-0', namespace: 'monitoring', ownerKind: 'StatefulSet', ownerName: 'loki', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 300, memRequest: 1_000_000_000, cpuUsage: 200, memUsage: 800_000_000, startedAt: ago(720) },
      // node-3 — light load + kube-system pods
      { name: 'coredns-abc123-x1y2z', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'coredns', nodeName: 'node-3', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 15, memUsage: 40_000_000, startedAt: ago(2160) },
      { name: 'coredns-abc123-a3b4c', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'coredns', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 12, memUsage: 38_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-d5e6f', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 10, memUsage: 30_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-g7h8i', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 8, memUsage: 28_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-j9k0l', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-3', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 9, memUsage: 29_000_000, startedAt: ago(2160) },
      // Pods with varied statuses for lifecycle animations
      { name: 'worker-6a5b4c-z9y8x', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-1', status: 'Pending', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(0.1) },
      { name: 'api-server-7f8b9c-crash1', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'CrashLoopBackOff', readyContainers: 0, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(2) },
      { name: 'batch-job-complete-abc', namespace: 'dev', ownerKind: 'Job', ownerName: 'batch-job', nodeName: 'node-2', status: 'Succeeded', readyContainers: 0, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(4) },
      { name: 'web-frontend-5c4d3e-fail1', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-3', status: 'Failed', readyContainers: 0, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(1) },
      { name: 'redis-evict-0', namespace: 'dev', ownerKind: 'StatefulSet', ownerName: 'redis', nodeName: 'node-3', status: 'Terminating', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 10, memUsage: 50_000_000, startedAt: ago(168) },
    ],

    // ── Pod details (lookup by "namespace/podName") ──────────────────────────
    podDetails: {
      'dev/api-server-7f8b9c-x2k4q': {
        name: 'api-server-7f8b9c-x2k4q', namespace: 'dev', phase: 'Running', nodeName: 'node-1',
        nodeInstanceType: 'm5.xlarge', podIP: '10.244.1.12', hostIP: '172.16.0.1', qosClass: 'Burstable',
        startedAt: ago(10),
        labels: { app: 'api-server', 'app.kubernetes.io/name': 'api-server', 'pod-template-hash': '7f8b9c' },
        annotations: { 'prometheus.io/scrape': 'true', 'prometheus.io/port': '8080' },
        containers: [
          { name: 'api-server', image: 'ghcr.io/example/api-server:v1.5.2', ready: true, restartCount: 0, cpuRequest: 250, memRequest: 512_000_000, cpuLimit: 1000, memLimit: 1_000_000_000, cpuUsage: 180, memUsage: 380_000_000, lastState: '' },
        ],
        conditions: [
          { type: 'Ready', status: 'True' }, { type: 'ContainersReady', status: 'True' },
          { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: 'True' },
        ],
        events: [
          { type: 'Normal', reason: 'Scheduled', message: 'Successfully assigned dev/api-server-7f8b9c-x2k4q to node-1', count: 1, lastSeen: ago(10) },
          { type: 'Normal', reason: 'Pulled', message: 'Container image already present on machine', count: 1, lastSeen: ago(10) },
          { type: 'Normal', reason: 'Started', message: 'Started container api-server', count: 1, lastSeen: ago(10) },
        ],
      },
      'dev/api-server-7f8b9c-crash1': {
        name: 'api-server-7f8b9c-crash1', namespace: 'dev', phase: 'CrashLoopBackOff', nodeName: 'node-1',
        nodeInstanceType: 'm5.xlarge', podIP: '10.244.1.45', hostIP: '172.16.0.1', qosClass: 'Burstable',
        startedAt: ago(2),
        labels: { app: 'api-server', 'app.kubernetes.io/name': 'api-server', 'pod-template-hash': '7f8b9c' },
        annotations: { 'prometheus.io/scrape': 'true', 'prometheus.io/port': '8080' },
        containers: [
          { name: 'api-server', image: 'ghcr.io/example/api-server:v1.5.3-broken', ready: false, restartCount: 7, cpuRequest: 250, memRequest: 512_000_000, cpuLimit: 1000, memLimit: 1_000_000_000, cpuUsage: 0, memUsage: 0, lastState: 'OOMKilled' },
        ],
        conditions: [
          { type: 'Ready', status: 'False' }, { type: 'ContainersReady', status: 'False' },
          { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: 'True' },
        ],
        events: [
          { type: 'Normal', reason: 'Scheduled', message: 'Successfully assigned dev/api-server-7f8b9c-crash1 to node-1', count: 1, lastSeen: ago(2) },
          { type: 'Normal', reason: 'Pulled', message: 'Container image already present on machine', count: 7, lastSeen: ago(0.1) },
          { type: 'Normal', reason: 'Started', message: 'Started container api-server', count: 7, lastSeen: ago(0.1) },
          { type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container api-server', count: 6, lastSeen: ago(0.05) },
          { type: 'Warning', reason: 'OOMKilled', message: 'Container api-server was OOM killed with exit code 137', count: 7, lastSeen: ago(0.1) },
        ],
      },
      'dev/worker-6a5b4c-z9y8x': {
        name: 'worker-6a5b4c-z9y8x', namespace: 'dev', phase: 'Pending', nodeName: '',
        nodeInstanceType: '', podIP: '', hostIP: '', qosClass: 'Burstable',
        startedAt: ago(0.1),
        labels: { app: 'worker', 'app.kubernetes.io/name': 'worker', 'pod-template-hash': '6a5b4c' },
        annotations: {},
        containers: [
          { name: 'worker', image: 'ghcr.io/example/worker:v2.1.0', ready: false, restartCount: 0, cpuRequest: 200, memRequest: 512_000_000, cpuLimit: 800, memLimit: 1_000_000_000, cpuUsage: 0, memUsage: 0, lastState: '' },
        ],
        conditions: [
          { type: 'Ready', status: 'False' }, { type: 'ContainersReady', status: 'False' },
          { type: 'Initialized', status: 'True' }, { type: 'PodScheduled', status: 'False' },
        ],
        events: [
          { type: 'Warning', reason: 'FailedScheduling', message: 'Insufficient cpu: 0/4 nodes available (3 Insufficient cpu, 1 cordoned)', count: 3, lastSeen: ago(0.02) },
        ],
      },
    },

    // ── Audit logs ───────────────────────────────────────────────────────────
    auditLogs: [
      { id: 1, userId: 1, username: 'admin', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '192.168.1.42', timestamp: ago(1) },
      { id: 2, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 1, before: null, after: '{"name":"EU Dev Sleep"}', ipAddress: '192.168.1.42', timestamp: ago(720) },
      { id: 3, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 2, before: null, after: '{"name":"US Staging Nightly"}', ipAddress: '192.168.1.42', timestamp: ago(480) },
      { id: 4, userId: 2, username: 'operator1', action: 'policy.update', resourceType: 'policy', resourceId: 1, before: '{"mode":"plan"}', after: '{"mode":"apply"}', ipAddress: '10.0.0.5', timestamp: ago(360) },
      { id: 5, userId: 1, username: 'admin', action: 'guardrail.update', resourceType: 'guardrails', resourceId: 1, before: null, after: '{"protectCriticalPodNodes":true}', ipAddress: '192.168.1.42', timestamp: ago(48) },
      { id: 6, userId: 1, username: 'admin', action: 'user.create', resourceType: 'user', resourceId: 3, before: null, after: '{"username":"viewer1"}', ipAddress: '192.168.1.42', timestamp: ago(240) },
      { id: 7, userId: 2, username: 'operator1', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '10.0.0.5', timestamp: ago(12) },
      { id: 8, userId: 1, username: 'admin', action: 'policy.sleep', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"scheduled","executionId":1}', ipAddress: null, timestamp: ago(58) },
      { id: 9, userId: 1, username: 'admin', action: 'policy.wake', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"scheduled","executionId":2}', ipAddress: null, timestamp: ago(46) },
      { id: 10, userId: 1, username: 'admin', action: 'policy.sleep', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":3}', ipAddress: null, timestamp: ago(30) },
      { id: 13, userId: 1, username: 'admin', action: 'exception.create', resourceType: 'exception', resourceId: 1, before: null, after: '{"type":"stay_awake","ticketRef":"OPS-1234"}', ipAddress: '192.168.1.42', timestamp: ago(12) },
      { id: 14, userId: 2, username: 'operator1', action: 'exception.create', resourceType: 'exception', resourceId: 2, before: null, after: '{"type":"stay_awake","ticketRef":"STAGING-99"}', ipAddress: '10.0.0.5', timestamp: ago(6) },
      { id: 15, userId: 1, username: 'admin', action: 'policy.wake', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"manual","executionId":7}', ipAddress: '192.168.1.42', timestamp: ago(10) },
      { id: 16, userId: 3, username: 'viewer1', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '172.20.0.8', timestamp: ago(48) },
      { id: 17, userId: 1, username: 'admin', action: 'policy.sleep', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":6}', ipAddress: null, timestamp: ago(6) },
      { id: 18, userId: 4, username: 'jane.doe', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '10.10.0.3', timestamp: ago(24) },
      { id: 19, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 3, before: null, after: '{"name":"Cost Optimization (Plan Only)"}', ipAddress: '192.168.1.42', timestamp: ago(168) },
      { id: 20, userId: 1, username: 'admin', action: 'exception.create', resourceType: 'exception', resourceId: 3, before: null, after: '{"type":"force_sleep","ticketRef":"COST-42"}', ipAddress: '192.168.1.42', timestamp: ago(80) },
    ],

    // ── Cluster + version ────────────────────────────────────────────────────
    clusterInfo: { apiServer: 'https://k8s.example.com:6443', kubernetesVersion: 'v1.31.2', authMode: 'local+oidc', clusterName: 'dev-cluster' },
    versionInfo: { version: '0.8.0-mock', goVersion: 'go1.23.0', uptime: '3d 14h 22m' },
  }
}

export let db = createSeedData()

export function resetDB() {
  db = createSeedData()
}

export function nextId(entity) {
  return db._seq[entity]++
}
