// SPDX-License-Identifier: Apache-2.0

package auth

import "testing"

func TestHasPermission(t *testing.T) {
	tests := []struct {
		role string
		perm Permission
		want bool
	}{
		// Admin has everything
		{"admin", PermViewAll, true},
		{"admin", PermScheduleEdit, true},
		{"admin", PermUserManage, true},
		{"admin", PermAdminResetDB, true},

		// Operator has edit/trigger but not user manage or reset
		{"operator", PermViewAll, true},
		{"operator", PermScheduleEdit, true},
		{"operator", PermScheduleTrigger, true},
		{"operator", PermUserManage, false},
		{"operator", PermAdminResetDB, false},

		// Viewer is read-only + password change
		{"viewer", PermViewAll, true},
		{"viewer", PermAuditView, true},
		{"viewer", PermPasswordChange, true},
		{"viewer", PermScheduleEdit, false},
		{"viewer", PermScheduleTrigger, false},
		{"viewer", PermUserManage, false},
		{"viewer", PermAdminResetDB, false},

		// Unknown role has nothing
		{"unknown", PermViewAll, false},
		{"", PermViewAll, false},
	}
	for _, tt := range tests {
		got := HasPermission(tt.role, tt.perm)
		if got != tt.want {
			t.Errorf("HasPermission(%q, %q) = %v, want %v", tt.role, tt.perm, got, tt.want)
		}
	}
}

func TestPermissionsForRole(t *testing.T) {
	adminPerms := PermissionsForRole("admin")
	if len(adminPerms) != len(AllPermissions) {
		t.Errorf("admin should have all %d permissions, got %d", len(AllPermissions), len(adminPerms))
	}

	viewerPerms := PermissionsForRole("viewer")
	if len(viewerPerms) != 3 {
		t.Errorf("viewer should have 3 permissions, got %d", len(viewerPerms))
	}

	unknownPerms := PermissionsForRole("nonexistent")
	if len(unknownPerms) != 0 {
		t.Errorf("unknown role should have 0 permissions, got %d", len(unknownPerms))
	}
}

func TestValidRole(t *testing.T) {
	if !ValidRole("admin") {
		t.Error("admin should be valid")
	}
	if !ValidRole("operator") {
		t.Error("operator should be valid")
	}
	if !ValidRole("viewer") {
		t.Error("viewer should be valid")
	}
	if ValidRole("superadmin") {
		t.Error("superadmin should not be valid")
	}
	if ValidRole("") {
		t.Error("empty string should not be valid")
	}
}
