import ComponentDetail from './ComponentDetail'

const COMPONENT_KEYS = [
  'router', 'auth', 'handlers', 'scheduler', 'scaler',
  'k8s-client', 'store', 'ws-broker',
  'http_rate', 'latency_p99', 'policy_executions', 'k8s_api',
  'ws_connections', 'cache_hit', 'scheduler_health', 'error_rate',
]

export function generateStaticParams() {
  return COMPONENT_KEYS.map((component) => ({ component }))
}

export default async function ComponentDetailPage({ params }: { params: Promise<{ component: string }> }) {
  const { component } = await params
  return <ComponentDetail component={component} />
}
