// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"strings"
	"testing"
)

// Direct updates and imports must accept and reject the same protection
// settings so importing a file cannot bypass normal guardrail validation.
func TestGuardrailProtectionValidation_UpdateAndImport(t *testing.T) {
	base := guardrailsExportBody{
		ProtectedNamespaces:   "kube-system,monitoring",
		SkipNsNode:            "monitoring",
		SkipNodeLabels:        "example.com/protected=true",
		SkipNodeTaints:        "dedicated=infra:NoSchedule",
		SchedulerEvalInterval: "30s",
		ScalingConcurrency:    10,
		WakeWavePauseSeconds:  90,
	}
	for _, tt := range []struct {
		field   string
		value   string
		wantErr bool
	}{
		{"skipNodeLabels", "=true", true},
		{"skipNodeLabels", "example.com/=true", true},
		{"skipNodeLabels", "key=has space", true},
		{"skipNodeLabels", "key=value=extra", true},
		{"skipNodeLabels", "UpperCase.example/key=value", true},
		{"skipNodeLabels", "key=" + strings.Repeat("v", 64), true},
		{"skipNodeLabels", "example.com/Role=GPU, node-role.kubernetes.io/control-plane=", false},
		{"skipNodeLabels", "", false},
		{"skipNodeLabels", " , , ", false},
		{"skipNodeTaints", "=v:NoSchedule", true},
		{"skipNodeTaints", "k=v:", true},
		{"skipNodeTaints", "k=v:Sometimes", true},
		{"skipNodeTaints", "k=v:noschedule", true},
		{"skipNodeTaints", "k=v:NoSchedule:NoExecute", true},
		{"skipNodeTaints", "k=v=other:NoExecute", true},
		{"skipNodeTaints", "k=invalid/value:NoExecute", true},
		{"skipNodeTaints", "dedicated=infra:PreferNoSchedule,node.kubernetes.io/unschedulable=:NoSchedule", false},
		{"skipNodeTaints", "dedicated=infra:NoExecute", false},
		{"skipNodeTaints", "", false},
		{"skipNodeTaints", " , , ", false},
		{"protectedNamespaces", "", true},
		{"protectedNamespaces", " , , ", true},
		{"protectedNamespaces", "kube-system, BadName", true},
		{"protectedNamespaces", "name.with.dots", true},
		{"protectedNamespaces", "name_with_underscores", true},
		{"protectedNamespaces", "-invalid", true},
		{"protectedNamespaces", strings.Repeat("a", 64), true},
		{"protectedNamespaces", " , kube-system , monitoring, ", false},
		{"skipNsNode", "BadName", true},
		{"skipNsNode", "valid, invalid/name", true},
		{"skipNsNode", strings.Repeat("a", 64), true},
		{"skipNsNode", "monitoring,karpenter", false},
		{"skipNsNode", "", false},
		{"skipNsNode", " , , ", false},
		{"scalingPriorityNamespaces", "prod, BadName", true},
		{"scalingPriorityNamespaces", "prod,prod", true},
		{"scalingPriorityNamespaces", "prod, dev", false},
		{"scalingPriorityNamespaces", "", false},
	} {
		t.Run(tt.field+"/"+tt.value, func(t *testing.T) {
			encoded, err := json.Marshal(base)
			if err != nil {
				t.Fatal(err)
			}
			var update map[string]interface{}
			if err := json.Unmarshal(encoded, &update); err != nil {
				t.Fatal(err)
			}
			update[tt.field] = tt.value
			if msg := validateGuardrailFields(update); (msg != "") != tt.wantErr {
				t.Errorf("update validation = %q, want error %v", msg, tt.wantErr)
			}
			encoded, err = json.Marshal(update)
			if err != nil {
				t.Fatal(err)
			}
			var imported guardrailsExportBody
			if err := json.Unmarshal(encoded, &imported); err != nil {
				t.Fatal(err)
			}
			if msg := validateGuardrailsImport(imported); (msg != "") != tt.wantErr {
				t.Errorf("import validation = %q, want error %v", msg, tt.wantErr)
			}
		})
	}
}

// Node namespace exclusions use a CSV string contract. Reject other JSON
// shapes instead of silently discarding the requested protection.
func TestGuardrailProtectionValidation_SkipNsNodeMustBeString(t *testing.T) {
	if msg := validateGuardrailFields(map[string]interface{}{"skipNsNode": []string{"monitoring"}}); msg != "skipNsNode must be a string" {
		t.Errorf("validation = %q, want skipNsNode type error", msg)
	}
}
