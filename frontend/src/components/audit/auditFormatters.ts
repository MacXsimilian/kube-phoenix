// ── Audit action labels ─────────────────────────────────────────────────────

type AuditAction =
  | 'policy.create' | 'policy.update' | 'policy.delete' | 'policy.sleep' | 'policy.wake'
  | 'policy.override.create' | 'policy.override.delete'
  | 'exception.create' | 'exception.update' | 'exception.delete'
  | 'guardrail.update' | 'admin.reset_db'
  | 'user.create' | 'user.update' | 'user.delete'
  | 'auth.login' | 'auth.logout' | 'auth.password_change'

const ACTION_LABELS: Record<AuditAction, string> = {
  'policy.create': 'Policy Create', 'policy.update': 'Policy Update', 'policy.delete': 'Policy Delete',
  'policy.sleep': 'Policy Sleep', 'policy.wake': 'Policy Wake',
  'policy.override.create': 'Override Create', 'policy.override.delete': 'Override Delete',
  'exception.create': 'Exception Create', 'exception.update': 'Exception Update', 'exception.delete': 'Exception Delete',
  'guardrail.update': 'Guardrail Update',
  'admin.reset_db': 'Reset Database',
  'user.create': 'User Create', 'user.update': 'User Update', 'user.delete': 'User Delete',
  'auth.login': 'Login', 'auth.logout': 'Logout', 'auth.password_change': 'Password Change',
}

export function formatActionLabel(action: string): string {
  return (ACTION_LABELS as Record<string, string>)[action] ?? action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function actionColor(action: string): 'error' | 'warning' | 'info' | 'success' | 'default' {
  if (action === 'admin.reset_db') return 'error'
  if (action.endsWith('.delete')) return 'error'
  if (action.endsWith('.create')) return 'success'
  if (action === 'auth.login') return 'success'
  if (action === 'auth.logout') return 'default'
  if (action.endsWith('.sleep') || action.endsWith('.wake') || action === 'auth.password_change') return 'warning'
  return 'info'
}
