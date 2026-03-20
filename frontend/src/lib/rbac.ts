/** Check if the user has a specific permission. */
export function hasPerm(permissions: string[] | undefined, perm: string): boolean {
  return permissions?.includes(perm) ?? false
}

// Convenience wrappers for common checks.
export const canEditSchedules    = (p?: string[]) => hasPerm(p, 'schedule.edit')
export const canTriggerSchedules = (p?: string[]) => hasPerm(p, 'schedule.trigger')
export const canEditGuardrails   = (p?: string[]) => hasPerm(p, 'guardrail.edit')
export const canManageUsers      = (p?: string[]) => hasPerm(p, 'user.manage')
export const canResetDB          = (p?: string[]) => hasPerm(p, 'admin.reset_db')
export const canViewAudit        = (p?: string[]) => hasPerm(p, 'audit.view')
