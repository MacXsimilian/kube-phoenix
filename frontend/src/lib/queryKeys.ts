export const queryKeys = {
  workloads: () => ['workloads'] as const,
  nodes: () => ['nodes'] as const,
  guardrails: () => ['guardrails'] as const,
  policies: () => ['policies'] as const,
  policy: (id: number) => ['policy', id] as const,
  policyExecutions: (policyId?: number) =>
    policyId != null
      ? ['policy-executions', policyId] as const
      : ['policy-executions'] as const,
  policyExecutionsFeed: () => ['policy-executions', 'feed'] as const,
  policyExecutionsTable: (page: number, rowsPerPage: number, status: string, direction: string) =>
    ['policy-executions', page, rowsPerPage, status, direction] as const,
  policyExecutionPoll: (id: number | undefined) => ['policy-execution-poll', id] as const,
  policyExecutionsFetch: (id: number) => ['policy-executions', { id }] as const,
  auditLogs: (page: number, pageSize: number, user: string, action: string, from: string, to: string) =>
    ['audit-logs', page, pageSize, user, action, from, to] as const,
  exceptions: (policyId?: number) =>
    policyId != null
      ? ['exceptions', policyId] as const
      : ['exceptions'] as const,
  users: () => ['users'] as const,
  logs: (executionId: number | undefined) => ['logs', executionId] as const,
  podDetail: (namespace: string, podName: string) => ['pod-detail', namespace, podName] as const,
  nodePods: (nodeName: string | undefined) => ['node-pods', nodeName] as const,
  workloadPods: (ns: string | undefined, kind: string | undefined, name: string | undefined) =>
    ['workload-pods', ns, kind, name] as const,
  clusterInfo: () => ['cluster-info'] as const,
  version: () => ['version'] as const,
  sessions: () => ['sessions'] as const,
  oidcConfig: () => ['oidc-config'] as const,
  overview: () => ['overview'] as const,
} as const
