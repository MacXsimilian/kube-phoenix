/**
 * In-memory seed data store for the mock API.
 * All entities are cross-referenced by ID.
 */

const now = new Date()
const iso = (d) => d.toISOString()
const ago = (hours) => iso(new Date(now.getTime() - hours * 3600_000))
const future = (hours) => iso(new Date(now.getTime() + hours * 3600_000))

const ADMIN_PERMISSIONS = [
  'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit',
  'user.manage', 'admin.reset_db', 'admin.emergency_scale', 'audit.view', 'password.change',
]
const OPERATOR_PERMISSIONS = [
  'view.all', 'schedule.edit', 'schedule.trigger', 'guardrail.edit', 'audit.view', 'password.change',
]
const VIEWER_PERMISSIONS = ['view.all', 'password.change']

function createSeedData() {
  return {
    _seq: {
      policy: 9,
      user: 16,
      execution: 26,
      logLine: 300,
      exception: 13,
      audit: 51,
      session: 8,
    },

    // ── Auth / current user ──────────────────────────────────────────────────
    currentUser: {
      id: 1, username: 'admin', givenName: 'Max', familyName: 'Mustermann',
      email: 'admin@example.com', role: 'admin', source: 'local', enabled: true,
      createdAt: ago(8760), lastLoginAt: ago(1),
      defaultTimezone: 'Europe/Berlin',
      permissions: ADMIN_PERMISSIONS,
    },

    users: [
      {
        id: 1, username: 'admin', givenName: 'Max', familyName: 'Mustermann',
        email: 'admin@example.com', role: 'admin', source: 'local', enabled: true,
        createdAt: ago(8760), lastLoginAt: ago(1),
        permissions: ADMIN_PERMISSIONS,
      },
      {
        id: 2, username: 'operator1', givenName: 'Sarah', familyName: 'Chen',
        email: 'sarah.chen@example.com', role: 'operator', source: 'local', enabled: true,
        createdAt: ago(6000), lastLoginAt: ago(4),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 3, username: 'viewer1', givenName: 'Tom', familyName: 'Johnson',
        email: 'tom.johnson@example.com', role: 'viewer', source: 'local', enabled: true,
        createdAt: ago(4320), lastLoginAt: ago(48),
        permissions: VIEWER_PERMISSIONS,
      },
      {
        id: 4, username: 'jane.doe', givenName: 'Jane', familyName: 'Doe',
        email: 'jane.doe@example.com', role: 'operator', source: 'oidc', enabled: true,
        createdAt: ago(2160), lastLoginAt: ago(6),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 5, username: 'disabled-user', givenName: 'Old', familyName: 'Account',
        email: 'old.account@example.com', role: 'viewer', source: 'local', enabled: false,
        createdAt: ago(8760), lastLoginAt: ago(2160),
        permissions: [],
      },
      {
        id: 6, username: 'emily.watson', givenName: 'Emily', familyName: 'Watson',
        email: 'emily.watson@example.com', role: 'admin', source: 'oidc', enabled: true,
        createdAt: ago(7200), lastLoginAt: ago(2),
        permissions: ADMIN_PERMISSIONS,
      },
      {
        id: 7, username: 'raj.patel', givenName: 'Raj', familyName: 'Patel',
        email: 'raj.patel@example.com', role: 'operator', source: 'oidc', enabled: true,
        createdAt: ago(5400), lastLoginAt: ago(8),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 8, username: 'lisa.kim', givenName: 'Lisa', familyName: 'Kim',
        email: 'lisa.kim@example.com', role: 'operator', source: 'local', enabled: true,
        createdAt: ago(4320), lastLoginAt: ago(12),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 9, username: 'alex.rivera', givenName: 'Alex', familyName: 'Rivera',
        email: 'alex.rivera@example.com', role: 'viewer', source: 'local', enabled: true,
        createdAt: ago(720), lastLoginAt: ago(24),
        permissions: VIEWER_PERMISSIONS,
      },
      {
        id: 10, username: 'marcus.weber', givenName: 'Marcus', familyName: 'Weber',
        email: 'marcus.weber@example.com', role: 'operator', source: 'oidc', enabled: true,
        createdAt: ago(3600), lastLoginAt: ago(3),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 11, username: 'yuki.tanaka', givenName: 'Yuki', familyName: 'Tanaka',
        email: 'yuki.tanaka@example.com', role: 'operator', source: 'local', enabled: true,
        createdAt: ago(2880), lastLoginAt: ago(16),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 12, username: 'fatima.alhassan', givenName: 'Fatima', familyName: 'Al-Hassan',
        email: 'fatima.alhassan@example.com', role: 'viewer', source: 'oidc', enabled: true,
        createdAt: ago(2160), lastLoginAt: ago(72),
        permissions: VIEWER_PERMISSIONS,
      },
      {
        id: 13, username: 'carlos.mendez', givenName: 'Carlos', familyName: 'Mendez',
        email: 'carlos.mendez@example.com', role: 'operator', source: 'local', enabled: true,
        createdAt: ago(1440), lastLoginAt: ago(5),
        permissions: OPERATOR_PERMISSIONS,
      },
      {
        id: 14, username: 'sophie.laurent', givenName: 'Sophie', familyName: 'Laurent',
        email: 'sophie.laurent@example.com', role: 'admin', source: 'oidc', enabled: true,
        createdAt: ago(4320), lastLoginAt: ago(10),
        permissions: ADMIN_PERMISSIONS,
      },
      {
        id: 15, username: 'deactivated-svc', givenName: 'Service', familyName: 'Bot',
        email: 'svc-bot@example.com', role: 'operator', source: 'local', enabled: false,
        createdAt: ago(6000), lastLoginAt: ago(4320),
        permissions: [],
      },
    ],

    sessions: [
      { id: 1, ipAddress: '192.168.1.42', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', createdAt: ago(2), expiresAt: future(6), isCurrent: true },
      { id: 2, ipAddress: '10.0.0.5', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', createdAt: ago(26), expiresAt: ago(2), isCurrent: false },
      { id: 3, ipAddress: '172.20.0.8', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0', createdAt: ago(48), expiresAt: ago(24), isCurrent: false },
      { id: 4, ipAddress: '192.168.1.42', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', createdAt: ago(72), expiresAt: ago(48), isCurrent: false },
      { id: 5, ipAddress: '10.10.0.3', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) Chrome/125.0', createdAt: ago(6), expiresAt: future(2), isCurrent: false },
      { id: 6, ipAddress: '192.168.5.20', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/124.0', createdAt: ago(4), expiresAt: future(4), isCurrent: false },
      { id: 7, ipAddress: '10.0.0.22', userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1', createdAt: ago(12), expiresAt: ago(4), isCurrent: false },
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
      protectedNamespaces: 'kube-system,kube-node-lease',
      skipNsNode: '',
      skipNodeLabels: '',
      skipNodeTaints: '',
      scalingPriorityNamespaces: '',
      schedulerEvalInterval: '30s',
      schedulerAutoWake: true,
      schedulerReconcileWhileAwake: true,
      scalingConcurrency: 5,
      wakeWaveSize: 3,
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
        createdAt: ago(8760), updatedAt: ago(48), nextTransitionAt: future(8),
      },
      {
        id: 2, name: 'US Staging Nightly', description: 'Sleep staging environment overnight US time',
        namespaceFilter: 'staging,staging-*', labelSelector: '',
        sleepWindows: [
          { name: 'Nightly', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '22:00', endTime: '06:00', allDay: false },
        ],
        timezone: 'America/New_York', mode: 'apply', enabled: true, timeoutMinutes: 10,
        currentState: 'sleeping', stateSince: ago(6), lastSleepAt: ago(6), lastWakeAt: ago(18),
        createdAt: ago(6000), updatedAt: ago(72), nextTransitionAt: future(2),
      },
      {
        id: 3, name: 'Cost Optimization (Plan Only)', description: 'Dry-run policy for monitoring namespace to estimate savings',
        namespaceFilter: 'monitoring', labelSelector: 'cost-tier=standard',
        sleepWindows: [
          { name: 'Off-peak', daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '08:00', allDay: false },
        ],
        timezone: 'UTC', mode: 'plan', enabled: false, timeoutMinutes: 5,
        currentState: 'awake', stateSince: ago(168), lastSleepAt: null, lastWakeAt: null,
        createdAt: ago(2160), updatedAt: ago(168), nextTransitionAt: null,
      },
      {
        id: 4, name: 'QA Environment Sleep', description: 'Scale QA workloads to zero outside testing windows',
        namespaceFilter: 'qa', labelSelector: '',
        sleepWindows: [
          { name: 'After hours', daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '08:00', allDay: false },
          { name: 'Weekend', daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
        ],
        timezone: 'Europe/Berlin', mode: 'apply', enabled: true, timeoutMinutes: 10,
        currentState: 'sleeping', stateSince: ago(10), lastSleepAt: ago(10), lastWakeAt: ago(22),
        createdAt: ago(4320), updatedAt: ago(240), nextTransitionAt: future(6),
      },
      {
        id: 5, name: 'Data Pipeline Off-Hours', description: 'Reduce data pipeline resources during non-batch windows',
        namespaceFilter: 'data-pipeline', labelSelector: '',
        sleepWindows: [
          { name: 'Daytime idle', daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00', allDay: false },
        ],
        timezone: 'America/Chicago', mode: 'apply', enabled: true, timeoutMinutes: 20,
        currentState: 'awake', stateSince: ago(3), lastSleepAt: ago(15), lastWakeAt: ago(3),
        createdAt: ago(2880), updatedAt: ago(120), nextTransitionAt: future(5),
      },
      {
        id: 6, name: 'ML Training Cluster', description: 'Scale down ML training workloads when no jobs queued',
        namespaceFilter: 'ml-platform', labelSelector: 'tier=training',
        sleepWindows: [
          { name: 'Off-hours', daysOfWeek: [1, 2, 3, 4, 5], startTime: '22:00', endTime: '06:00', allDay: false },
          { name: 'Weekend', daysOfWeek: [0, 6], startTime: '00:00', endTime: '00:00', allDay: true },
        ],
        timezone: 'America/Los_Angeles', mode: 'apply', enabled: true, timeoutMinutes: 30,
        currentState: 'sleeping', stateSince: ago(8), lastSleepAt: ago(8), lastWakeAt: ago(20),
        createdAt: ago(1440), updatedAt: ago(336), nextTransitionAt: future(4),
      },
      {
        id: 7, name: 'Production Canary Scale-Down', description: 'Plan-only policy to preview production scale-down savings',
        namespaceFilter: 'production', labelSelector: 'tier=canary',
        sleepWindows: [
          { name: 'Late night', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '02:00', endTime: '05:00', allDay: false },
        ],
        timezone: 'UTC', mode: 'plan', enabled: true, timeoutMinutes: 5,
        currentState: 'awake', stateSince: ago(3), lastSleepAt: null, lastWakeAt: null,
        createdAt: ago(720), updatedAt: ago(72), nextTransitionAt: future(18),
      },
      {
        id: 8, name: 'Observability Trim', description: 'Scale non-critical observability tools during quiet hours',
        namespaceFilter: 'observability', labelSelector: 'priority!=critical',
        sleepWindows: [
          { name: 'Night window', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '01:00', endTime: '06:00', allDay: false },
        ],
        timezone: 'Europe/Berlin', mode: 'apply', enabled: true, timeoutMinutes: 10,
        currentState: 'awake', stateSince: ago(2), lastSleepAt: ago(14), lastWakeAt: ago(2),
        createdAt: ago(480), updatedAt: ago(96), nextTransitionAt: future(17),
      },
    ],

    // ── Executions ───────────────────────────────────────────────────────────
    executions: [
      // Policy 1 — EU Dev Sleep
      { id: 1, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(58), finishedAt: ago(57.8), status: 'success', mode: 'apply', countScaled: 6, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 1, countDeleted: 0 },
      { id: 2, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(46), finishedAt: ago(45.9), status: 'success', mode: 'apply', countScaled: 6, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 5, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(34), finishedAt: ago(33.7), status: 'success', mode: 'apply', countScaled: 6, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 1, countDeleted: 0 },
      { id: 7, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'wake', trigger: 'manual_wake', startedAt: ago(10), finishedAt: ago(9.9), status: 'success', mode: 'apply', countScaled: 6, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 25, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(0.05), finishedAt: null, status: 'running', mode: 'apply', countScaled: 0, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Policy 2 — US Staging Nightly
      { id: 3, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(30), finishedAt: ago(29.7), status: 'success', mode: 'apply', countScaled: 5, countSkipped: 1, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 4, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(18), finishedAt: ago(17.9), status: 'success', mode: 'apply', countScaled: 5, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 6, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(6), finishedAt: ago(5.8), status: 'success', mode: 'apply', countScaled: 5, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Policy 4 — QA Environment Sleep
      { id: 8, policyId: 4, policy: { name: 'QA Environment Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(82), finishedAt: ago(81.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 9, policyId: 4, policy: { name: 'QA Environment Sleep' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(70), finishedAt: ago(69.9), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 14, policyId: 4, policy: { name: 'QA Environment Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(10), finishedAt: ago(9.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Policy 5 — Data Pipeline Off-Hours
      { id: 10, policyId: 5, policy: { name: 'Data Pipeline Off-Hours' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(15), finishedAt: ago(14.7), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 11, policyId: 5, policy: { name: 'Data Pipeline Off-Hours' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(3), finishedAt: ago(2.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 15, policyId: 5, policy: { name: 'Data Pipeline Off-Hours' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(39), finishedAt: ago(38.6), status: 'failed', mode: 'apply', countScaled: 2, countSkipped: 0, countErrors: 2, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Policy 6 — ML Training Cluster
      { id: 12, policyId: 6, policy: { name: 'ML Training Cluster' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(8), finishedAt: ago(7.7), status: 'success', mode: 'apply', countScaled: 3, countSkipped: 1, countErrors: 0, countProtected: 0, countDrained: 1, countDeleted: 1 },
      { id: 16, policyId: 6, policy: { name: 'ML Training Cluster' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(32), finishedAt: ago(31.5), status: 'success', mode: 'apply', countScaled: 3, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 17, policyId: 6, policy: { name: 'ML Training Cluster' }, direction: 'sleep', trigger: 'manual_sleep', startedAt: ago(56), finishedAt: ago(55.8), status: 'interrupted', mode: 'apply', countScaled: 1, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Policy 7 — Production Canary (plan-only)
      { id: 13, policyId: 7, policy: { name: 'Production Canary Scale-Down' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(3), finishedAt: ago(2.9), status: 'success', mode: 'plan', countScaled: 0, countSkipped: 0, countErrors: 0, countProtected: 2, countDrained: 0, countDeleted: 0 },
      { id: 22, policyId: 7, policy: { name: 'Production Canary Scale-Down' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(27), finishedAt: ago(26.9), status: 'success', mode: 'plan', countScaled: 0, countSkipped: 0, countErrors: 0, countProtected: 2, countDrained: 0, countDeleted: 0 },

      // Policy 8 — Observability Trim
      { id: 18, policyId: 8, policy: { name: 'Observability Trim' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(14), finishedAt: ago(13.8), status: 'success', mode: 'apply', countScaled: 2, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 19, policyId: 8, policy: { name: 'Observability Trim' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(2), finishedAt: ago(1.9), status: 'success', mode: 'apply', countScaled: 2, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },

      // Misc — skipped and failed
      { id: 20, policyId: 1, policy: { name: 'EU Dev Sleep' }, direction: 'sleep', trigger: 'scheduled', startedAt: ago(130), finishedAt: ago(130), status: 'skipped', mode: 'apply', countScaled: 0, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 21, policyId: 2, policy: { name: 'US Staging Nightly' }, direction: 'wake', trigger: 'scheduled', startedAt: ago(42), finishedAt: ago(41.5), status: 'failed', mode: 'apply', countScaled: 3, countSkipped: 0, countErrors: 2, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 23, policyId: 4, policy: { name: 'QA Environment Sleep' }, direction: 'sleep', trigger: 'override_start', startedAt: ago(50), finishedAt: ago(49.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
      { id: 24, policyId: 5, policy: { name: 'Data Pipeline Off-Hours' }, direction: 'wake', trigger: 'exception_end', startedAt: ago(63), finishedAt: ago(62.8), status: 'success', mode: 'apply', countScaled: 4, countSkipped: 0, countErrors: 0, countProtected: 0, countDrained: 0, countDeleted: 0 },
    ],

    // ── Log lines (per execution) ────────────────────────────────────────────
    logLines: [
      // Execution 1 (sleep dev)
      { id: 1, executionId: 1, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "dev,dev-*"  label selector: ""', timestamp: ago(58) },
      { id: 2, executionId: 1, seq: 2, level: 'info', message: 'Fetching Deployments...', timestamp: ago(57.99) },
      { id: 3, executionId: 1, seq: 3, level: 'info', message: 'Fetching StatefulSets...', timestamp: ago(57.98) },
      { id: 4, executionId: 1, seq: 4, level: 'info', message: 'Found 6 matching workloads in namespace dev', timestamp: ago(57.97) },
      { id: 5, executionId: 1, seq: 5, level: 'info', message: 'Estimate: sleep 6 workloads → ~24 K8s API calls with concurrency 5', timestamp: ago(57.96) },
      { id: 6, executionId: 1, seq: 6, level: 'ok', message: 'Slept Deployment dev/api-server (was 3 replicas)', timestamp: ago(57.93) },
      { id: 7, executionId: 1, seq: 7, level: 'ok', message: 'Slept Deployment dev/web-frontend (was 2 replicas)', timestamp: ago(57.91) },
      { id: 8, executionId: 1, seq: 8, level: 'ok', message: 'Slept StatefulSet dev/redis (was 1 replicas)', timestamp: ago(57.89) },
      { id: 9, executionId: 1, seq: 9, level: 'ok', message: 'Slept Deployment dev/worker (was 2 replicas)', timestamp: ago(57.87) },
      { id: 10, executionId: 1, seq: 10, level: 'ok', message: 'Slept Deployment dev/event-processor (was 3 replicas)', timestamp: ago(57.85) },
      { id: 11, executionId: 1, seq: 11, level: 'ok', message: 'Slept Deployment dev/notification-svc (was 2 replicas)', timestamp: ago(57.83) },
      { id: 12, executionId: 1, seq: 12, level: 'info', message: 'Fetching nodes...', timestamp: ago(57.82) },
      { id: 13, executionId: 1, seq: 13, level: 'info', message: 'Draining node node-3 (pods=3 timeout=105s)...', timestamp: ago(57.81) },
      { id: 14, executionId: 1, seq: 14, level: 'ok', message: 'Drained node node-3', timestamp: ago(57.80) },
      { id: 15, executionId: 1, seq: 15, level: 'ok', message: 'Sleep complete in 3.2s — scaled 6 workloads, 0 skipped, 0 errors, 24 K8s API calls (7.5 req/s)', timestamp: ago(57.8) },

      // Execution 2 (wake dev)
      { id: 16, executionId: 2, seq: 1, level: 'info', message: 'Policy wake — restoring 6 snapshotted workloads (namespace filter: "dev,dev-*")', timestamp: ago(46) },
      { id: 17, executionId: 2, seq: 2, level: 'info', message: 'Estimate: wake 6 workloads → ~30 K8s API calls with concurrency 5', timestamp: ago(45.99) },
      { id: 18, executionId: 2, seq: 3, level: 'info', message: 'Wave scaling: 6 workloads in 2 waves of 3 (max 1m30s pause between waves)', timestamp: ago(45.98) },
      { id: 19, executionId: 2, seq: 4, level: 'info', message: 'Wave 1/2 — scaling 3 workloads', timestamp: ago(45.97) },
      { id: 20, executionId: 2, seq: 5, level: 'ok', message: 'Restored Deployment dev/api-server → 3 replicas', timestamp: ago(45.95) },
      { id: 21, executionId: 2, seq: 6, level: 'ok', message: 'Restored Deployment dev/web-frontend → 2 replicas', timestamp: ago(45.93) },
      { id: 22, executionId: 2, seq: 7, level: 'ok', message: 'Restored StatefulSet dev/redis → 1 replicas', timestamp: ago(45.92) },
      { id: 23, executionId: 2, seq: 8, level: 'info', message: 'Wave 1/2: all 3 workloads ready', timestamp: ago(45.91) },
      { id: 24, executionId: 2, seq: 9, level: 'info', message: 'Wave 2/2 — scaling 3 workloads', timestamp: ago(45.90) },
      { id: 25, executionId: 2, seq: 10, level: 'ok', message: 'Restored Deployment dev/worker → 2 replicas', timestamp: ago(45.89) },
      { id: 26, executionId: 2, seq: 11, level: 'ok', message: 'Restored Deployment dev/event-processor → 3 replicas', timestamp: ago(45.88) },
      { id: 27, executionId: 2, seq: 12, level: 'ok', message: 'Restored Deployment dev/notification-svc → 2 replicas', timestamp: ago(45.87) },
      { id: 28, executionId: 2, seq: 13, level: 'ok', message: 'Wake complete in 2.8s — restored 6 workloads, 0 skipped, 0 errors, 30 K8s API calls (10.7 req/s)', timestamp: ago(45.9) },

      // Execution 3 (sleep staging)
      { id: 29, executionId: 3, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "staging,staging-*"  label selector: ""', timestamp: ago(30) },
      { id: 30, executionId: 3, seq: 2, level: 'info', message: 'Found 6 matching workloads in namespaces staging', timestamp: ago(29.98) },
      { id: 31, executionId: 3, seq: 3, level: 'info', message: 'Estimate: sleep 5 workloads → ~20 K8s API calls with concurrency 5', timestamp: ago(29.97) },
      { id: 32, executionId: 3, seq: 4, level: 'ok', message: 'Slept Deployment staging/checkout-svc (was 2 replicas)', timestamp: ago(29.95) },
      { id: 33, executionId: 3, seq: 5, level: 'ok', message: 'Slept Deployment staging/product-api (was 3 replicas)', timestamp: ago(29.92) },
      { id: 34, executionId: 3, seq: 6, level: 'ok', message: 'Slept Deployment staging/cart-svc (was 2 replicas)', timestamp: ago(29.89) },
      { id: 35, executionId: 3, seq: 7, level: 'ok', message: 'Slept StatefulSet staging/postgres (was 1 replicas)', timestamp: ago(29.86) },
      { id: 36, executionId: 3, seq: 8, level: 'ok', message: 'Slept Deployment staging/search-indexer (was 2 replicas)', timestamp: ago(29.83) },
      { id: 37, executionId: 3, seq: 9, level: 'info', message: 'Already at 0 replicas: Deployment staging/payment-gateway (snapshotted, not scaled)', timestamp: ago(29.8) },
      { id: 38, executionId: 3, seq: 10, level: 'ok', message: 'Sleep complete in 3.5s — scaled 5 workloads, 1 skipped, 0 errors, 20 K8s API calls (5.7 req/s)', timestamp: ago(29.7) },

      // Execution 6 (latest sleep staging)
      { id: 40, executionId: 6, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "staging,staging-*"  label selector: ""', timestamp: ago(6) },
      { id: 41, executionId: 6, seq: 2, level: 'info', message: 'Found 6 matching workloads in namespace staging', timestamp: ago(5.98) },
      { id: 42, executionId: 6, seq: 3, level: 'ok', message: 'Slept Deployment staging/checkout-svc (was 2 replicas)', timestamp: ago(5.95) },
      { id: 43, executionId: 6, seq: 4, level: 'ok', message: 'Slept Deployment staging/product-api (was 3 replicas)', timestamp: ago(5.92) },
      { id: 44, executionId: 6, seq: 5, level: 'ok', message: 'Slept Deployment staging/cart-svc (was 2 replicas)', timestamp: ago(5.89) },
      { id: 45, executionId: 6, seq: 6, level: 'ok', message: 'Slept StatefulSet staging/postgres (was 1 replicas)', timestamp: ago(5.86) },
      { id: 46, executionId: 6, seq: 7, level: 'ok', message: 'Slept Deployment staging/search-indexer (was 2 replicas)', timestamp: ago(5.83) },
      { id: 47, executionId: 6, seq: 8, level: 'ok', message: 'Slept Deployment staging/payment-gateway (was 1 replicas)', timestamp: ago(5.81) },
      { id: 48, executionId: 6, seq: 9, level: 'ok', message: 'Sleep complete in 2.9s — scaled 6 workloads, 0 skipped, 0 errors, 24 K8s API calls (8.3 req/s)', timestamp: ago(5.8) },

      // Execution 15 (failed data-pipeline)
      { id: 100, executionId: 15, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "data-pipeline"  label selector: ""', timestamp: ago(39) },
      { id: 101, executionId: 15, seq: 2, level: 'info', message: 'Found 4 matching workloads in namespace data-pipeline', timestamp: ago(38.98) },
      { id: 102, executionId: 15, seq: 3, level: 'ok', message: 'Slept Deployment data-pipeline/kafka-consumer (was 3 replicas)', timestamp: ago(38.95) },
      { id: 103, executionId: 15, seq: 4, level: 'ok', message: 'Slept Deployment data-pipeline/etl-processor (was 2 replicas)', timestamp: ago(38.92) },
      { id: 104, executionId: 15, seq: 5, level: 'error', message: 'Failed to scale Deployment data-pipeline/spark-driver: context deadline exceeded after 30s', timestamp: ago(38.7) },
      { id: 105, executionId: 15, seq: 6, level: 'error', message: 'Failed to scale StatefulSet data-pipeline/airflow-scheduler: connection refused', timestamp: ago(38.65) },
      { id: 106, executionId: 15, seq: 7, level: 'error', message: 'Sleep failed in 4.2s — scaled 2 workloads, 0 skipped, 2 errors, 16 K8s API calls (3.8 req/s)', timestamp: ago(38.6) },

      // Execution 17 (interrupted ML)
      { id: 110, executionId: 17, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "ml-platform"  label selector: "tier=training"', timestamp: ago(56) },
      { id: 111, executionId: 17, seq: 2, level: 'info', message: 'Found 3 matching workloads in namespace ml-platform', timestamp: ago(55.98) },
      { id: 112, executionId: 17, seq: 3, level: 'ok', message: 'Slept Deployment ml-platform/training-coordinator (was 1 replicas)', timestamp: ago(55.95) },
      { id: 113, executionId: 17, seq: 4, level: 'warn', message: 'Execution interrupted by manual cancel request', timestamp: ago(55.85) },
      { id: 114, executionId: 17, seq: 5, level: 'info', message: 'Sleep interrupted — scaled 1 workloads, 0 skipped, 0 errors', timestamp: ago(55.8) },

      // Execution 21 (failed staging wake)
      { id: 120, executionId: 21, seq: 1, level: 'info', message: 'Policy wake — restoring 5 snapshotted workloads (namespace filter: "staging,staging-*")', timestamp: ago(42) },
      { id: 121, executionId: 21, seq: 2, level: 'ok', message: 'Restored Deployment staging/checkout-svc → 2 replicas', timestamp: ago(41.95) },
      { id: 122, executionId: 21, seq: 3, level: 'ok', message: 'Restored Deployment staging/product-api → 3 replicas', timestamp: ago(41.92) },
      { id: 123, executionId: 21, seq: 4, level: 'ok', message: 'Restored Deployment staging/cart-svc → 2 replicas', timestamp: ago(41.89) },
      { id: 124, executionId: 21, seq: 5, level: 'error', message: 'Failed to restore StatefulSet staging/postgres: PVC not bound — volume claim pending', timestamp: ago(41.7) },
      { id: 125, executionId: 21, seq: 6, level: 'error', message: 'Failed to restore Deployment staging/search-indexer: image pull backoff — ghcr.io/example/search-indexer:v2.3.1 not found', timestamp: ago(41.6) },
      { id: 126, executionId: 21, seq: 7, level: 'error', message: 'Wake failed in 3.8s — restored 3 workloads, 0 skipped, 2 errors, 25 K8s API calls (6.6 req/s)', timestamp: ago(41.5) },

      // Execution 20 (skipped)
      { id: 130, executionId: 20, seq: 1, level: 'info', message: 'Policy sleep — namespace filter: "dev,dev-*"  label selector: ""', timestamp: ago(130) },
      { id: 131, executionId: 20, seq: 2, level: 'info', message: 'Skipped — active exception "Black Friday traffic test" (OPS-1234) overrides sleep', timestamp: ago(130) },

      // Execution 25 (running) — log lines generated dynamically by WebSocket handler
    ],

    // ── Workload snapshots ───────────────────────────────────────────────────
    snapshots: [
      // Policy 1 latest sleep/wake cycle
      { id: 1, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'api-server', replicasBefore: 3, replicasRestored: 3, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 2, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'web-frontend', replicasBefore: 2, replicasRestored: 2, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 3, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'StatefulSet', name: 'redis', replicasBefore: 1, replicasRestored: 1, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 4, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'worker', replicasBefore: 2, replicasRestored: 2, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 5, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'event-processor', replicasBefore: 3, replicasRestored: 3, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },
      { id: 6, policyId: 1, sleepExecutionId: 5, wakeExecutionId: 7, namespace: 'dev', kind: 'Deployment', name: 'notification-svc', replicasBefore: 2, replicasRestored: 2, restoredAt: ago(10), wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(34) },

      // Policy 2 latest sleep (still sleeping)
      { id: 7, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'checkout-svc', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 8, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'product-api', replicasBefore: 3, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 9, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'cart-svc', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 10, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'StatefulSet', name: 'postgres', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 11, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'search-indexer', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },
      { id: 12, policyId: 2, sleepExecutionId: 6, wakeExecutionId: null, namespace: 'staging', kind: 'Deployment', name: 'payment-gateway', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(6) },

      // Policy 6 ML training (sleeping)
      { id: 13, policyId: 6, sleepExecutionId: 12, wakeExecutionId: null, namespace: 'ml-platform', kind: 'Deployment', name: 'training-coordinator', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(8) },
      { id: 14, policyId: 6, sleepExecutionId: 12, wakeExecutionId: null, namespace: 'ml-platform', kind: 'Deployment', name: 'model-server', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(8) },
      { id: 15, policyId: 6, sleepExecutionId: 12, wakeExecutionId: null, namespace: 'ml-platform', kind: 'StatefulSet', name: 'feature-store', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(8) },

      // Policy 4 QA (sleeping)
      { id: 16, policyId: 4, sleepExecutionId: 14, wakeExecutionId: null, namespace: 'qa', kind: 'Deployment', name: 'test-runner', replicasBefore: 2, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(10) },
      { id: 17, policyId: 4, sleepExecutionId: 14, wakeExecutionId: null, namespace: 'qa', kind: 'Deployment', name: 'mock-server', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(10) },
      { id: 18, policyId: 4, sleepExecutionId: 14, wakeExecutionId: null, namespace: 'qa', kind: 'Deployment', name: 'selenium-grid', replicasBefore: 3, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(10) },
      { id: 19, policyId: 4, sleepExecutionId: 14, wakeExecutionId: null, namespace: 'qa', kind: 'Deployment', name: 'report-generator', replicasBefore: 1, replicasRestored: null, restoredAt: null, wasAlreadyZero: false, wasDeletedAtWake: false, wasExternallyScaled: false, capturedAt: ago(10) },
    ],


    // ── Scheduled exceptions ─────────────────────────────────────────────────
    exceptions: [
      {
        id: 1, policyId: 1, exceptionType: 'stay_awake',
        startsAt: future(24), endsAt: future(48), ticketRef: 'OPS-1234',
        reason: 'Black Friday traffic test — keep dev online for load testing', sleepOnEnd: true,
        namespaceFilter: 'dev', labelSelector: '', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'admin',
        createdAt: ago(12), updatedAt: ago(12), workloadTargets: [],
      },
      {
        id: 2, policyId: 2, exceptionType: 'stay_awake',
        startsAt: ago(4), endsAt: future(8), ticketRef: 'STAGING-99',
        reason: 'QA regression suite running on staging', sleepOnEnd: false,
        namespaceFilter: 'staging', labelSelector: '', status: 'active',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'operator1',
        createdAt: ago(6), updatedAt: ago(4), workloadTargets: [],
      },
      {
        id: 3, policyId: 1, exceptionType: 'force_sleep',
        startsAt: ago(72), endsAt: ago(48), ticketRef: 'COST-42',
        reason: 'Emergency cost reduction — budget overrun alert', sleepOnEnd: false,
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
        namespaceFilter: 'dev', labelSelector: '', status: 'completed',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'operator1',
        createdAt: ago(120), updatedAt: ago(96), workloadTargets: [],
      },
      {
        id: 7, policyId: 4, exceptionType: 'stay_awake',
        startsAt: ago(50), endsAt: ago(38), ticketRef: 'QA-SPRINT-12',
        reason: 'Sprint 12 QA cycle — extended testing window', sleepOnEnd: true,
        namespaceFilter: 'qa', labelSelector: '', status: 'completed',
        startExecutionId: 23, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'marcus.weber',
        createdAt: ago(52), updatedAt: ago(38), workloadTargets: [],
      },
      {
        id: 8, policyId: 5, exceptionType: 'stay_awake',
        startsAt: ago(63), endsAt: ago(51), ticketRef: 'DATA-MIGRATE-7',
        reason: 'Database migration — pipeline must remain active during data backfill', sleepOnEnd: true,
        namespaceFilter: 'data-pipeline', labelSelector: '', status: 'completed',
        startExecutionId: null, endExecutionId: 24,
        cancelledAt: null, cancelReason: '', createdBy: 'yuki.tanaka',
        createdAt: ago(65), updatedAt: ago(51), workloadTargets: [],
      },
      {
        id: 9, policyId: 6, exceptionType: 'stay_awake',
        startsAt: future(12), endsAt: future(36), ticketRef: 'ML-TRAIN-445',
        reason: 'Large model training run — do not interrupt GPU workloads', sleepOnEnd: false,
        namespaceFilter: 'ml-platform', labelSelector: 'tier=training', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'carlos.mendez',
        createdAt: ago(3), updatedAt: ago(3),
        workloadTargets: [
          { kind: 'Deployment', namespace: 'ml-platform', name: 'training-coordinator' },
          { kind: 'Deployment', namespace: 'ml-platform', name: 'model-server' },
        ],
      },
      {
        id: 10, policyId: 2, exceptionType: 'force_sleep',
        startsAt: ago(96), endsAt: ago(84), ticketRef: 'SEC-PATCH-3',
        reason: 'Security patch window — staging forced offline for CVE remediation', sleepOnEnd: false,
        namespaceFilter: 'staging', labelSelector: '', status: 'completed',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'sophie.laurent',
        createdAt: ago(100), updatedAt: ago(84), workloadTargets: [],
      },
      {
        id: 11, policyId: 5, exceptionType: 'stay_awake',
        startsAt: ago(24), endsAt: ago(12), ticketRef: 'DATA-HOTFIX-2',
        reason: 'Emergency data reprocessing after upstream schema change', sleepOnEnd: true,
        namespaceFilter: 'data-pipeline', labelSelector: '', status: 'completed',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: ago(18), cancelReason: 'Reprocessing completed ahead of schedule',
        createdBy: 'raj.patel',
        createdAt: ago(25), updatedAt: ago(18), workloadTargets: [],
      },
      {
        id: 12, policyId: 8, exceptionType: 'stay_awake',
        startsAt: future(72), endsAt: future(96), ticketRef: 'OBS-AUDIT-1',
        reason: 'Compliance audit — observability must remain active for log collection', sleepOnEnd: true,
        namespaceFilter: 'observability', labelSelector: '', status: 'pending',
        startExecutionId: null, endExecutionId: null,
        cancelledAt: null, cancelReason: '', createdBy: 'fatima.alhassan',
        createdAt: ago(6), updatedAt: ago(6), workloadTargets: [],
      },
    ],

    // ── Workloads ────────────────────────────────────────────────────────────
    workloads: [
      // dev namespace — currently awake (policy 1)
      { namespace: 'dev', name: 'api-server', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },
      { namespace: 'dev', name: 'web-frontend', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'dev', name: 'redis', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'dev', name: 'worker', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'dev', name: 'event-processor', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 1, status: 'partial' },
      { namespace: 'dev', name: 'notification-svc', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },

      // staging namespace — currently sleeping (policy 2)
      { namespace: 'staging', name: 'checkout-svc', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'product-api', kind: 'Deployment', currentReplicas: 0, savedReplicas: 3, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'cart-svc', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'postgres', kind: 'StatefulSet', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'search-indexer', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'staging', name: 'payment-gateway', kind: 'Deployment', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },

      // qa namespace — currently sleeping (policy 4)
      { namespace: 'qa', name: 'test-runner', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'qa', name: 'mock-server', kind: 'Deployment', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'qa', name: 'selenium-grid', kind: 'Deployment', currentReplicas: 0, savedReplicas: 3, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'qa', name: 'report-generator', kind: 'Deployment', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },

      // data-pipeline namespace — currently awake (policy 5)
      { namespace: 'data-pipeline', name: 'spark-driver', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'data-pipeline', name: 'kafka-consumer', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },
      { namespace: 'data-pipeline', name: 'etl-processor', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'data-pipeline', name: 'airflow-scheduler', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },

      // ml-platform namespace — sleeping (policy 6)
      { namespace: 'ml-platform', name: 'jupyter-hub', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'ml-platform', name: 'model-server', kind: 'Deployment', currentReplicas: 0, savedReplicas: 2, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'ml-platform', name: 'feature-store', kind: 'StatefulSet', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },
      { namespace: 'ml-platform', name: 'training-coordinator', kind: 'Deployment', currentReplicas: 0, savedReplicas: 1, readyReplicas: 0, status: 'sleeping' },

      // monitoring namespace — always running (policy 3 is plan-only + disabled)
      { namespace: 'monitoring', name: 'prometheus', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'grafana', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'alertmanager', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'loki', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
      { namespace: 'monitoring', name: 'thanos-compact', kind: 'StatefulSet', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },

      // observability namespace — currently awake (policy 8)
      { namespace: 'observability', name: 'jaeger', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'observability', name: 'otel-collector', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },

      // kube-system namespace — system-protected
      { namespace: 'kube-system', name: 'coredns', kind: 'Deployment', currentReplicas: 2, savedReplicas: null, readyReplicas: 2, status: 'running' },
      { namespace: 'kube-system', name: 'kube-proxy', kind: 'Deployment', currentReplicas: 3, savedReplicas: null, readyReplicas: 3, status: 'running' },
      { namespace: 'kube-system', name: 'metrics-server', kind: 'Deployment', currentReplicas: 1, savedReplicas: null, readyReplicas: 1, status: 'running' },
    ],

    // ── Nodes ────────────────────────────────────────────────────────────────
    nodes: [
      {
        name: 'node-1', instanceType: 'm5.xlarge', zone: 'eu-west-1a', podCount: 14,
        status: 'active', protectionReason: null,
        cpuAllocatable: 4000, cpuRequested: 3200, memAllocatable: 16_000_000_000, memRequested: 12_500_000_000,
        createdAt: ago(8760), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.xlarge', 'topology.kubernetes.io/zone': 'eu-west-1a', 'team': 'platform' },
        taints: [],
      },
      {
        name: 'node-2', instanceType: 'm5.xlarge', zone: 'eu-west-1b', podCount: 10,
        status: 'protected', protectionReason: 'Hosts kube-system critical pods',
        cpuAllocatable: 4000, cpuRequested: 2400, memAllocatable: 16_000_000_000, memRequested: 9_800_000_000,
        createdAt: ago(8760), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.xlarge', 'topology.kubernetes.io/zone': 'eu-west-1b', 'team': 'platform' },
        taints: [],
      },
      {
        name: 'node-3', instanceType: 'm5.large', zone: 'eu-west-1a', podCount: 4,
        status: 'would-drain', protectionReason: null,
        cpuAllocatable: 2000, cpuRequested: 500, memAllocatable: 8_000_000_000, memRequested: 1_400_000_000,
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
      {
        name: 'node-5', instanceType: 'm5.2xlarge', zone: 'eu-west-1a', podCount: 8,
        status: 'active', protectionReason: null,
        cpuAllocatable: 8000, cpuRequested: 5600, memAllocatable: 32_000_000_000, memRequested: 22_000_000_000,
        createdAt: ago(4320), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'm5.2xlarge', 'topology.kubernetes.io/zone': 'eu-west-1a', 'workload-type': 'data' },
        taints: [],
      },
      {
        name: 'node-6', instanceType: 'c5.xlarge', zone: 'eu-west-1b', podCount: 6,
        status: 'active', protectionReason: null,
        cpuAllocatable: 4000, cpuRequested: 2200, memAllocatable: 8_000_000_000, memRequested: 5_600_000_000,
        createdAt: ago(2160), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'c5.xlarge', 'topology.kubernetes.io/zone': 'eu-west-1b', 'workload-type': 'compute' },
        taints: [],
      },
      {
        name: 'node-7', instanceType: 'r5.large', zone: 'eu-west-1c', podCount: 5,
        status: 'active', protectionReason: null,
        cpuAllocatable: 2000, cpuRequested: 1200, memAllocatable: 16_000_000_000, memRequested: 11_000_000_000,
        createdAt: ago(1440), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'r5.large', 'topology.kubernetes.io/zone': 'eu-west-1c', 'workload-type': 'memory' },
        taints: [],
      },
      {
        name: 'node-8', instanceType: 'p3.2xlarge', zone: 'eu-west-1a', podCount: 2,
        status: 'would-drain', protectionReason: null,
        cpuAllocatable: 8000, cpuRequested: 400, memAllocatable: 61_000_000_000, memRequested: 2_000_000_000,
        createdAt: ago(480), cordoned: false,
        labels: { 'node.kubernetes.io/instance-type': 'p3.2xlarge', 'topology.kubernetes.io/zone': 'eu-west-1a', 'workload-type': 'gpu', 'nvidia.com/gpu': '1' },
        taints: [{ key: 'nvidia.com/gpu', value: 'present', effect: 'NoSchedule' }],
      },
    ],

    // ── Pods ─────────────────────────────────────────────────────────────────
    pods: [
      // dev/api-server (3 replicas)
      { name: 'api-server-7f8b9c-x2k4q', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 180, memUsage: 380_000_000, startedAt: ago(10) },
      { name: 'api-server-7f8b9c-m9p2j', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 140, memUsage: 350_000_000, startedAt: ago(10) },
      { name: 'api-server-7f8b9c-q4r7w', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 160, memUsage: 370_000_000, startedAt: ago(10) },

      // dev/web-frontend (2 replicas)
      { name: 'web-frontend-5c4d3e-h8j2k', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 60, memUsage: 180_000_000, startedAt: ago(10) },
      { name: 'web-frontend-5c4d3e-p3n6f', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 55, memUsage: 170_000_000, startedAt: ago(10) },

      // dev/redis (1 replica)
      { name: 'redis-0', namespace: 'dev', ownerKind: 'StatefulSet', ownerName: 'redis', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 50, memUsage: 650_000_000, startedAt: ago(168) },

      // dev/worker (2 replicas)
      { name: 'worker-6a5b4c-d2e8f', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 120, memUsage: 400_000_000, startedAt: ago(10) },
      { name: 'worker-6a5b4c-g7h3i', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 90, memUsage: 380_000_000, startedAt: ago(10) },

      // dev/event-processor (3 replicas, only 1 ready)
      { name: 'event-processor-3b2a1c-r4s5t', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'event-processor', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 150, memUsage: 420_000_000, startedAt: ago(10) },
      { name: 'event-processor-3b2a1c-u6v7w', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'event-processor', nodeName: 'node-2', status: 'CrashLoopBackOff', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(8) },
      { name: 'event-processor-3b2a1c-x8y9z', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'event-processor', nodeName: 'node-1', status: 'CrashLoopBackOff', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(8) },

      // dev/notification-svc (2 replicas)
      { name: 'notification-svc-a1b2c3-k4l5m', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'notification-svc', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 40, memUsage: 140_000_000, startedAt: ago(10) },
      { name: 'notification-svc-a1b2c3-n6o7p', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'notification-svc', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 35, memUsage: 130_000_000, startedAt: ago(10) },

      // data-pipeline (all awake)
      { name: 'spark-driver-d4e5f6-a1b2c', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'spark-driver', nodeName: 'node-5', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 400, memUsage: 1_800_000_000, startedAt: ago(3) },
      { name: 'spark-driver-d4e5f6-c3d4e', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'spark-driver', nodeName: 'node-5', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 380, memUsage: 1_700_000_000, startedAt: ago(3) },
      { name: 'kafka-consumer-e5f6g7-f5g6h', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'kafka-consumer', nodeName: 'node-5', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 300, memRequest: 1_000_000_000, cpuUsage: 250, memUsage: 800_000_000, startedAt: ago(3) },
      { name: 'kafka-consumer-e5f6g7-h7i8j', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'kafka-consumer', nodeName: 'node-5', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 300, memRequest: 1_000_000_000, cpuUsage: 220, memUsage: 750_000_000, startedAt: ago(3) },
      { name: 'kafka-consumer-e5f6g7-k9l0m', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'kafka-consumer', nodeName: 'node-6', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 300, memRequest: 1_000_000_000, cpuUsage: 240, memUsage: 780_000_000, startedAt: ago(3) },
      { name: 'etl-processor-f6g7h8-n1o2p', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'etl-processor', nodeName: 'node-5', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 400, memRequest: 1_500_000_000, cpuUsage: 350, memUsage: 1_200_000_000, startedAt: ago(3) },
      { name: 'etl-processor-f6g7h8-q3r4s', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'etl-processor', nodeName: 'node-6', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 400, memRequest: 1_500_000_000, cpuUsage: 320, memUsage: 1_100_000_000, startedAt: ago(3) },
      { name: 'airflow-scheduler-0', namespace: 'data-pipeline', ownerKind: 'StatefulSet', ownerName: 'airflow-scheduler', nodeName: 'node-6', status: 'Running', readyContainers: 2, totalContainers: 2, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 300, memUsage: 1_400_000_000, startedAt: ago(72) },

      // ml-platform (jupyter-hub awake, rest sleeping)
      { name: 'jupyter-hub-g7h8i9-t5u6v', namespace: 'ml-platform', ownerKind: 'Deployment', ownerName: 'jupyter-hub', nodeName: 'node-8', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 80, memUsage: 600_000_000, startedAt: ago(48) },

      // monitoring (always running)
      { name: 'prometheus-0', namespace: 'monitoring', ownerKind: 'StatefulSet', ownerName: 'prometheus', nodeName: 'node-7', status: 'Running', readyContainers: 2, totalContainers: 2, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 350, memUsage: 1_800_000_000, startedAt: ago(720) },
      { name: 'grafana-8d7e6f-k4l2m', namespace: 'monitoring', ownerKind: 'Deployment', ownerName: 'grafana', nodeName: 'node-7', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 80, memUsage: 300_000_000, startedAt: ago(720) },
      { name: 'alertmanager-9c8d7e-n5o3p', namespace: 'monitoring', ownerKind: 'Deployment', ownerName: 'alertmanager', nodeName: 'node-7', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 20, memUsage: 120_000_000, startedAt: ago(720) },
      { name: 'loki-0', namespace: 'monitoring', ownerKind: 'StatefulSet', ownerName: 'loki', nodeName: 'node-7', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 300, memRequest: 1_000_000_000, cpuUsage: 200, memUsage: 800_000_000, startedAt: ago(720) },
      { name: 'thanos-compact-0', namespace: 'monitoring', ownerKind: 'StatefulSet', ownerName: 'thanos-compact', nodeName: 'node-7', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 150, memUsage: 700_000_000, startedAt: ago(480) },

      // observability (awake)
      { name: 'jaeger-h8i9j0-w7x8y', namespace: 'observability', ownerKind: 'Deployment', ownerName: 'jaeger', nodeName: 'node-6', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 120, memUsage: 350_000_000, startedAt: ago(2) },
      { name: 'jaeger-h8i9j0-z9a0b', namespace: 'observability', ownerKind: 'Deployment', ownerName: 'jaeger', nodeName: 'node-6', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 110, memUsage: 340_000_000, startedAt: ago(2) },
      { name: 'otel-collector-i9j0k1-c1d2e', namespace: 'observability', ownerKind: 'Deployment', ownerName: 'otel-collector', nodeName: 'node-6', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 140, memUsage: 380_000_000, startedAt: ago(2) },
      { name: 'otel-collector-i9j0k1-f3g4h', namespace: 'observability', ownerKind: 'Deployment', ownerName: 'otel-collector', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 130, memUsage: 360_000_000, startedAt: ago(2) },
      { name: 'otel-collector-i9j0k1-i5j6k', namespace: 'observability', ownerKind: 'Deployment', ownerName: 'otel-collector', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 125, memUsage: 370_000_000, startedAt: ago(2) },

      // kube-system (protected)
      { name: 'coredns-abc123-x1y2z', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'coredns', nodeName: 'node-3', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 15, memUsage: 40_000_000, startedAt: ago(2160) },
      { name: 'coredns-abc123-a3b4c', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'coredns', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 12, memUsage: 38_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-d5e6f', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-1', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 10, memUsage: 30_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-g7h8i', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 8, memUsage: 28_000_000, startedAt: ago(2160) },
      { name: 'kube-proxy-j9k0l', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'kube-proxy', nodeName: 'node-3', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 128_000_000, cpuUsage: 9, memUsage: 29_000_000, startedAt: ago(2160) },
      { name: 'metrics-server-j0k1l2-m3n4o', namespace: 'kube-system', ownerKind: 'Deployment', ownerName: 'metrics-server', nodeName: 'node-2', status: 'Running', readyContainers: 1, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 25, memUsage: 120_000_000, startedAt: ago(720) },

      // Pods with varied statuses for lifecycle animations
      { name: 'worker-6a5b4c-z9y8x', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'worker', nodeName: 'node-1', status: 'Pending', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(0.1) },
      { name: 'api-server-7f8b9c-crash1', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'api-server', nodeName: 'node-1', status: 'CrashLoopBackOff', readyContainers: 0, totalContainers: 1, cpuRequest: 250, memRequest: 512_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(2) },
      { name: 'batch-job-complete-abc', namespace: 'dev', ownerKind: 'Job', ownerName: 'batch-job', nodeName: 'node-2', status: 'Succeeded', readyContainers: 0, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(4) },
      { name: 'web-frontend-5c4d3e-fail1', namespace: 'dev', ownerKind: 'Deployment', ownerName: 'web-frontend', nodeName: 'node-3', status: 'Failed', readyContainers: 0, totalContainers: 1, cpuRequest: 100, memRequest: 256_000_000, cpuUsage: 0, memUsage: 0, startedAt: ago(1) },
      { name: 'redis-evict-0', namespace: 'dev', ownerKind: 'StatefulSet', ownerName: 'redis', nodeName: 'node-3', status: 'Terminating', readyContainers: 0, totalContainers: 1, cpuRequest: 200, memRequest: 1_000_000_000, cpuUsage: 10, memUsage: 50_000_000, startedAt: ago(168) },
      { name: 'spark-driver-d4e5f6-init1', namespace: 'data-pipeline', ownerKind: 'Deployment', ownerName: 'spark-driver', nodeName: 'node-8', status: 'Init:0/2', readyContainers: 0, totalContainers: 1, cpuRequest: 500, memRequest: 2_000_000_000, cpuUsage: 50, memUsage: 200_000_000, startedAt: ago(0.05) },
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
          { type: 'Warning', reason: 'FailedScheduling', message: 'Insufficient cpu: 0/8 nodes available (5 Insufficient cpu, 1 cordoned, 2 would-drain)', count: 3, lastSeen: ago(0.02) },
        ],
      },
    },

    // ── Audit logs ───────────────────────────────────────────────────────────
    auditLogs: [
      // Auth events
      { id: 1, userId: 1, username: 'admin', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '192.168.1.42', timestamp: ago(1) },
      { id: 2, userId: 2, username: 'operator1', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '10.0.0.5', timestamp: ago(4) },
      { id: 3, userId: 4, username: 'jane.doe', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '10.10.0.3', timestamp: ago(6) },
      { id: 4, userId: 6, username: 'emily.watson', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '192.168.5.20', timestamp: ago(2) },
      { id: 5, userId: 7, username: 'raj.patel', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '10.0.0.22', timestamp: ago(8) },
      { id: 6, userId: 10, username: 'marcus.weber', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '172.20.5.10', timestamp: ago(3) },
      { id: 7, userId: 3, username: 'viewer1', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '172.20.0.8', timestamp: ago(48) },
      { id: 8, userId: 14, username: 'sophie.laurent', action: 'auth.login', resourceType: null, resourceId: null, before: null, after: null, ipAddress: '192.168.10.5', timestamp: ago(10) },

      // Policy CRUD
      { id: 9, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 1, before: null, after: '{"name":"EU Dev Sleep"}', ipAddress: '192.168.1.42', timestamp: ago(8760) },
      { id: 10, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 2, before: null, after: '{"name":"US Staging Nightly"}', ipAddress: '192.168.1.42', timestamp: ago(6000) },
      { id: 11, userId: 14, username: 'sophie.laurent', action: 'policy.create', resourceType: 'policy', resourceId: 4, before: null, after: '{"name":"QA Environment Sleep"}', ipAddress: '192.168.10.5', timestamp: ago(4320) },
      { id: 12, userId: 11, username: 'yuki.tanaka', action: 'policy.create', resourceType: 'policy', resourceId: 5, before: null, after: '{"name":"Data Pipeline Off-Hours"}', ipAddress: '10.0.0.44', timestamp: ago(2880) },
      { id: 13, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 3, before: null, after: '{"name":"Cost Optimization (Plan Only)"}', ipAddress: '192.168.1.42', timestamp: ago(2160) },
      { id: 14, userId: 13, username: 'carlos.mendez', action: 'policy.create', resourceType: 'policy', resourceId: 6, before: null, after: '{"name":"ML Training Cluster"}', ipAddress: '10.0.0.55', timestamp: ago(1440) },
      { id: 15, userId: 1, username: 'admin', action: 'policy.create', resourceType: 'policy', resourceId: 7, before: null, after: '{"name":"Production Canary Scale-Down"}', ipAddress: '192.168.1.42', timestamp: ago(720) },
      { id: 16, userId: 6, username: 'emily.watson', action: 'policy.create', resourceType: 'policy', resourceId: 8, before: null, after: '{"name":"Observability Trim"}', ipAddress: '192.168.5.20', timestamp: ago(480) },
      { id: 17, userId: 2, username: 'operator1', action: 'policy.update', resourceType: 'policy', resourceId: 1, before: '{"mode":"plan"}', after: '{"mode":"apply"}', ipAddress: '10.0.0.5', timestamp: ago(360) },
      { id: 18, userId: 7, username: 'raj.patel', action: 'policy.update', resourceType: 'policy', resourceId: 5, before: '{"timeoutMinutes":10}', after: '{"timeoutMinutes":20}', ipAddress: '10.0.0.22', timestamp: ago(120) },

      // Guardrails
      { id: 19, userId: 1, username: 'admin', action: 'guardrail.update', resourceType: 'guardrails', resourceId: 1, before: '{"protectCriticalPodNodes":false}', after: '{"protectCriticalPodNodes":true}', ipAddress: '192.168.1.42', timestamp: ago(48) },
      { id: 20, userId: 6, username: 'emily.watson', action: 'guardrail.update', resourceType: 'guardrails', resourceId: 1, before: '{"wakeWaveSize":0}', after: '{"wakeWaveSize":3}', ipAddress: '192.168.5.20', timestamp: ago(120) },

      // User management
      { id: 21, userId: 1, username: 'admin', action: 'user.create', resourceType: 'user', resourceId: 3, before: null, after: '{"username":"viewer1","role":"viewer"}', ipAddress: '192.168.1.42', timestamp: ago(4320) },
      { id: 22, userId: 1, username: 'admin', action: 'user.create', resourceType: 'user', resourceId: 8, before: null, after: '{"username":"lisa.kim","role":"operator"}', ipAddress: '192.168.1.42', timestamp: ago(4320) },
      { id: 23, userId: 1, username: 'admin', action: 'user.create', resourceType: 'user', resourceId: 9, before: null, after: '{"username":"alex.rivera","role":"viewer"}', ipAddress: '192.168.1.42', timestamp: ago(720) },
      { id: 24, userId: 14, username: 'sophie.laurent', action: 'user.update', resourceType: 'user', resourceId: 5, before: '{"enabled":true}', after: '{"enabled":false}', ipAddress: '192.168.10.5', timestamp: ago(2160) },
      { id: 25, userId: 1, username: 'admin', action: 'user.update', resourceType: 'user', resourceId: 15, before: '{"enabled":true}', after: '{"enabled":false}', ipAddress: '192.168.1.42', timestamp: ago(4320) },

      // Policy triggers (sleep/wake)
      { id: 26, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"scheduled","executionId":1}', ipAddress: null, timestamp: ago(58) },
      { id: 27, userId: null, username: 'system', action: 'policy.wake', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"scheduled","executionId":2}', ipAddress: null, timestamp: ago(46) },
      { id: 28, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":3}', ipAddress: null, timestamp: ago(30) },
      { id: 29, userId: null, username: 'system', action: 'policy.wake', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":4}', ipAddress: null, timestamp: ago(18) },
      { id: 30, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"scheduled","executionId":5}', ipAddress: null, timestamp: ago(34) },
      { id: 31, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":6}', ipAddress: null, timestamp: ago(6) },
      { id: 32, userId: 1, username: 'admin', action: 'policy.wake', resourceType: 'policy', resourceId: 1, before: null, after: '{"trigger":"manual_wake","executionId":7}', ipAddress: '192.168.1.42', timestamp: ago(10) },
      { id: 33, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 4, before: null, after: '{"trigger":"scheduled","executionId":8}', ipAddress: null, timestamp: ago(82) },
      { id: 34, userId: null, username: 'system', action: 'policy.wake', resourceType: 'policy', resourceId: 4, before: null, after: '{"trigger":"scheduled","executionId":9}', ipAddress: null, timestamp: ago(70) },
      { id: 35, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 5, before: null, after: '{"trigger":"scheduled","executionId":10}', ipAddress: null, timestamp: ago(15) },
      { id: 36, userId: null, username: 'system', action: 'policy.wake', resourceType: 'policy', resourceId: 5, before: null, after: '{"trigger":"scheduled","executionId":11}', ipAddress: null, timestamp: ago(3) },
      { id: 37, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 6, before: null, after: '{"trigger":"scheduled","executionId":12}', ipAddress: null, timestamp: ago(8) },
      { id: 38, userId: null, username: 'system', action: 'policy.sleep', resourceType: 'policy', resourceId: 5, before: null, after: '{"trigger":"scheduled","executionId":15,"status":"failed"}', ipAddress: null, timestamp: ago(39) },
      { id: 39, userId: 13, username: 'carlos.mendez', action: 'policy.sleep', resourceType: 'policy', resourceId: 6, before: null, after: '{"trigger":"manual_sleep","executionId":17,"status":"interrupted"}', ipAddress: '10.0.0.55', timestamp: ago(56) },
      { id: 40, userId: null, username: 'system', action: 'policy.wake', resourceType: 'policy', resourceId: 2, before: null, after: '{"trigger":"scheduled","executionId":21,"status":"failed"}', ipAddress: null, timestamp: ago(42) },

      // Exception events
      { id: 41, userId: 1, username: 'admin', action: 'exception.create', resourceType: 'exception', resourceId: 1, before: null, after: '{"type":"stay_awake","ticketRef":"OPS-1234"}', ipAddress: '192.168.1.42', timestamp: ago(12) },
      { id: 42, userId: 2, username: 'operator1', action: 'exception.create', resourceType: 'exception', resourceId: 2, before: null, after: '{"type":"stay_awake","ticketRef":"STAGING-99"}', ipAddress: '10.0.0.5', timestamp: ago(6) },
      { id: 43, userId: 1, username: 'admin', action: 'exception.create', resourceType: 'exception', resourceId: 3, before: null, after: '{"type":"force_sleep","ticketRef":"COST-42"}', ipAddress: '192.168.1.42', timestamp: ago(80) },
      { id: 44, userId: 10, username: 'marcus.weber', action: 'exception.create', resourceType: 'exception', resourceId: 7, before: null, after: '{"type":"stay_awake","ticketRef":"QA-SPRINT-12"}', ipAddress: '172.20.5.10', timestamp: ago(52) },
      { id: 45, userId: 11, username: 'yuki.tanaka', action: 'exception.create', resourceType: 'exception', resourceId: 8, before: null, after: '{"type":"stay_awake","ticketRef":"DATA-MIGRATE-7"}', ipAddress: '10.0.0.44', timestamp: ago(65) },
      { id: 46, userId: 13, username: 'carlos.mendez', action: 'exception.create', resourceType: 'exception', resourceId: 9, before: null, after: '{"type":"stay_awake","ticketRef":"ML-TRAIN-445"}', ipAddress: '10.0.0.55', timestamp: ago(3) },
      { id: 47, userId: 14, username: 'sophie.laurent', action: 'exception.create', resourceType: 'exception', resourceId: 10, before: null, after: '{"type":"force_sleep","ticketRef":"SEC-PATCH-3"}', ipAddress: '192.168.10.5', timestamp: ago(100) },
      { id: 48, userId: 7, username: 'raj.patel', action: 'exception.create', resourceType: 'exception', resourceId: 11, before: null, after: '{"type":"stay_awake","ticketRef":"DATA-HOTFIX-2"}', ipAddress: '10.0.0.22', timestamp: ago(25) },
      { id: 49, userId: 7, username: 'raj.patel', action: 'exception.cancel', resourceType: 'exception', resourceId: 11, before: '{"status":"active"}', after: '{"status":"cancelled","reason":"Reprocessing completed ahead of schedule"}', ipAddress: '10.0.0.22', timestamp: ago(18) },
      { id: 50, userId: 12, username: 'fatima.alhassan', action: 'exception.create', resourceType: 'exception', resourceId: 12, before: null, after: '{"type":"stay_awake","ticketRef":"OBS-AUDIT-1"}', ipAddress: '172.20.8.3', timestamp: ago(6) },
    ],

    // ── Cluster + version ────────────────────────────────────────────────────
    clusterInfo: { apiServer: 'https://k8s.example.com:6443', kubernetesVersion: 'v1.31.2', authMode: 'local+oidc', clusterName: 'prod-eu-west-1' },
    versionInfo: { version: '0.8.0-mock', goVersion: 'go1.23.0', uptime: '14d 6h 42m' },
  }
}

export let db = createSeedData()

export function resetDB() {
  db = createSeedData()
}

export function nextId(entity) {
  return db._seq[entity]++
}
