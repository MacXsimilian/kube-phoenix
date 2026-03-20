package auth

import "testing"

func TestMapGroupsToRole(t *testing.T) {
	admin := []string{"kube-phoenix-admins"}
	operator := []string{"kube-phoenix-operators"}

	tests := []struct {
		name   string
		groups []string
		want   string
	}{
		{"admin match", []string{"kube-phoenix-admins"}, "admin"},
		{"operator match", []string{"kube-phoenix-operators"}, "operator"},
		{"no match", []string{"random-group"}, "viewer"},
		{"empty groups", []string{}, "viewer"},
		{"nil groups", nil, "viewer"},
		{"case insensitive admin", []string{"Kube-Phoenix-Admins"}, "admin"},
		{"case insensitive operator", []string{"KUBE-PHOENIX-OPERATORS"}, "operator"},
		{"admin takes priority", []string{"kube-phoenix-operators", "kube-phoenix-admins"}, "admin"},
		{"multiple groups", []string{"team-a", "kube-phoenix-operators", "team-b"}, "operator"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MapGroupsToRole(tt.groups, admin, operator)
			if got != tt.want {
				t.Errorf("MapGroupsToRole(%v) = %q, want %q", tt.groups, got, tt.want)
			}
		})
	}
}
