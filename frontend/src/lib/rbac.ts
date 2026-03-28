/** Check if the user has a specific permission. */
function hasPerm(permissions: string[] | undefined, perm: string): boolean {
  return permissions?.includes(perm) ?? false
}

// Convenience wrappers for common checks.
export const canEditSchedules    = (permissions?: string[]) => hasPerm(permissions, 'schedule.edit')
export const canTriggerSchedules = (permissions?: string[]) => hasPerm(permissions, 'schedule.trigger')
export const canEditGuardrails   = (permissions?: string[]) => hasPerm(permissions, 'guardrail.edit')
export const canManageUsers      = (permissions?: string[]) => hasPerm(permissions, 'user.manage')
export const canResetDB          = (permissions?: string[]) => hasPerm(permissions, 'admin.reset_db')
export const canViewAudit        = (permissions?: string[]) => hasPerm(permissions, 'audit.view')
