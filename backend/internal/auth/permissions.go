// Package auth provides permission-based RBAC, rate limiting, and (later) OIDC helpers.
package auth

// Permission represents a granular action that can be allowed or denied per role.
type Permission string

const (
	PermViewAll         Permission = "view.all"
	PermScheduleEdit    Permission = "schedule.edit"
	PermScheduleTrigger Permission = "schedule.trigger"
	PermGuardrailEdit   Permission = "guardrail.edit"
	PermUserManage      Permission = "user.manage"
	PermAdminResetDB         Permission = "admin.reset_db"
	PermAdminEmergencyScale  Permission = "admin.emergency_scale"
	PermAuditView            Permission = "audit.view"
	PermPasswordChange       Permission = "password.change"
)

// AllPermissions is an ordered list used by the /api/auth/me endpoint to return
// the permission set for the authenticated user.
var AllPermissions = []Permission{
	PermViewAll, PermScheduleEdit, PermScheduleTrigger, PermGuardrailEdit,
	PermUserManage, PermAdminResetDB, PermAdminEmergencyScale, PermAuditView, PermPasswordChange,
}

// RolePermissions maps each role to its allowed permissions.
var RolePermissions = map[string]map[Permission]bool{
	"admin": {
		PermViewAll: true, PermScheduleEdit: true, PermScheduleTrigger: true,
		PermGuardrailEdit: true, PermUserManage: true, PermAdminResetDB: true,
		PermAdminEmergencyScale: true, PermAuditView: true, PermPasswordChange: true,
	},
	"operator": {
		PermViewAll: true, PermScheduleEdit: true, PermScheduleTrigger: true,
		PermGuardrailEdit: true, PermAuditView: true, PermPasswordChange: true,
	},
	"viewer": {
		PermViewAll: true, PermAuditView: true, PermPasswordChange: true,
	},
}

// HasPermission reports whether the given role has the specified permission.
func HasPermission(role string, perm Permission) bool {
	perms, ok := RolePermissions[role]
	if !ok {
		return false
	}
	return perms[perm]
}

// PermissionsForRole returns all permissions granted to the given role.
func PermissionsForRole(role string) []Permission {
	perms := RolePermissions[role]
	var out []Permission
	for _, p := range AllPermissions {
		if perms[p] {
			out = append(out, p)
		}
	}
	return out
}

// ValidRole reports whether role is one of the recognised roles.
func ValidRole(role string) bool {
	_, ok := RolePermissions[role]
	return ok
}
