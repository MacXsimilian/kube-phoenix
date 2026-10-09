// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// TestValidateEnvelope_SchemaMismatch rejects an envelope with the wrong
// schemaVersion.
func TestValidateEnvelope_SchemaMismatch(t *testing.T) {
	msg := validateEnvelope(99, exportKindPolicy, exportKindPolicy)
	if msg == "" {
		t.Fatal("expected schema mismatch to be rejected")
	}
	if !strings.Contains(msg, "schemaVersion") {
		t.Errorf("error should mention schemaVersion, got: %s", msg)
	}
}

// TestValidateEnvelope_KindMismatch rejects an envelope sent to the wrong
// endpoint.
func TestValidateEnvelope_KindMismatch(t *testing.T) {
	msg := validateEnvelope(exportSchemaVersion, exportKindPolicy, exportKindException)
	if !strings.Contains(msg, "kind") {
		t.Errorf("error should mention kind, got: %s", msg)
	}
}

// TestValidateEnvelope_Accepted accepts a matching envelope.
func TestValidateEnvelope_Accepted(t *testing.T) {
	if msg := validateEnvelope(exportSchemaVersion, exportKindPolicy, exportKindPolicy); msg != "" {
		t.Errorf("expected acceptance, got: %s", msg)
	}
}

func validPolicyBody() policyExportBody {
	return policyExportBody{
		Name:           "nightly",
		Timezone:       "UTC",
		Mode:           store.PolicyModePlan,
		Enabled:        false,
		TimeoutMinutes: 30,
		SleepWindows: []policy.SleepWindow{
			{DaysOfWeek: []int{1, 2, 3, 4, 5}, StartTime: "20:00", EndTime: "08:00"},
		},
	}
}

// An imported policy needs a usable name before it can be created or matched to
// an existing policy during overwrite.
func TestValidatePolicyImport_RejectsMissingName(t *testing.T) {
	body := validPolicyBody()
	body.Name = ""
	if msg := validatePolicyImport(body); msg == "" {
		t.Fatal("expected missing name to be rejected")
	}
}

// Import must enforce the same nonempty schedule requirement as policy creation;
// a structurally valid envelope alone does not make its contents usable.
func TestValidatePolicyImport_RejectsEmptyWindows(t *testing.T) {
	body := validPolicyBody()
	body.SleepWindows = nil
	if msg := validatePolicyImport(body); msg == "" {
		t.Fatal("expected empty sleepWindows to be rejected")
	}
}

// TestValidatePolicyImport_Accepts a well-formed payload.
func TestValidatePolicyImport_Accepts(t *testing.T) {
	if msg := validatePolicyImport(validPolicyBody()); msg != "" {
		t.Errorf("unexpected rejection: %s", msg)
	}
}

// TestPreparePolicyForImport_ForcesEnabledOffAndPlanMode verifies the design's
// safety rule: any imported policy is created disabled and in plan mode
// regardless of the source JSON.
func TestPreparePolicyForImport_ForcesEnabledOffAndPlanMode(t *testing.T) {
	body := validPolicyBody()
	body.Enabled = true
	body.Mode = store.PolicyModeApply
	p, msg := preparePolicyForImport(body, "")
	if msg != "" {
		t.Fatalf("preparePolicyForImport rejected valid body: %s", msg)
	}
	if p.Enabled {
		t.Error("imported policy must be disabled")
	}
	if p.Mode != store.PolicyModePlan {
		t.Errorf("imported policy mode = %q, want %q", p.Mode, store.PolicyModePlan)
	}
}

// TestPreparePolicyForImport_ApplyOverrideName uses overrideName for rename
// flow.
func TestPreparePolicyForImport_ApplyOverrideName(t *testing.T) {
	body := validPolicyBody()
	p, msg := preparePolicyForImport(body, "renamed-policy")
	if msg != "" {
		t.Fatalf("rejected: %s", msg)
	}
	if p.Name != "renamed-policy" {
		t.Errorf("Name = %q, want %q", p.Name, "renamed-policy")
	}
}

// Overwriting an existing policy uses the same disabled, plan-only defaults as
// creating an imported policy, even when the source requests immediate execution.
func TestPolicyBodyToUpdates_ForcesEnabledOffAndPlanMode(t *testing.T) {
	body := validPolicyBody()
	body.Enabled = true
	body.Mode = store.PolicyModeApply
	updates, msg := policyBodyToUpdates(body)
	if msg != "" {
		t.Fatalf("unexpected rejection: %s", msg)
	}
	if updates["enabled"] != false {
		t.Errorf("enabled update = %v, want false", updates["enabled"])
	}
	if updates["mode"] != store.PolicyModePlan {
		t.Errorf("mode update = %v, want %q", updates["mode"], store.PolicyModePlan)
	}
}

// TestValidateExceptionImport_RejectsPastWindow returns 422 when the window
// has already started — common when sharing a JSON between environments late.
func TestValidateExceptionImport_RejectsPastWindow(t *testing.T) {
	name := "nightly"
	body := exceptionExportBody{
		PolicyName:    &name,
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(-2 * time.Hour),
		EndsAt:        time.Now().Add(-time.Hour),
	}
	msg, status := validateExceptionImport(body)
	if msg == "" {
		t.Fatal("expected past window to be rejected")
	}
	if status != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", status)
	}
}

// A future exception can be imported using its parent's portable name;
// validation must not require a database ID from the source environment.
func TestValidateExceptionImport_AcceptsNamedParent(t *testing.T) {
	name := "nightly"
	body := exceptionExportBody{
		PolicyName:    &name,
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(time.Hour),
		EndsAt:        time.Now().Add(2 * time.Hour),
	}
	msg, _ := validateExceptionImport(body)
	if msg != "" {
		t.Errorf("future exception with a named parent must be accepted, got: %s", msg)
	}
}

// Unknown exception types have no defined scheduling behavior. Reject them with
// a bad-request status instead of persisting an exception the scheduler cannot use.
func TestValidateExceptionImport_RejectsBadType(t *testing.T) {
	name := "nightly"
	body := exceptionExportBody{
		PolicyName:    &name,
		ExceptionType: "garbage",
		StartsAt:      time.Now().Add(time.Hour),
		EndsAt:        time.Now().Add(2 * time.Hour),
	}
	msg, status := validateExceptionImport(body)
	if msg == "" {
		t.Fatal("expected invalid exceptionType to be rejected")
	}
	if status != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", status)
	}
}

// An exception must end after it starts. Reversed times cannot describe an active
// interval and should fail validation before import reaches the database.
func TestValidateExceptionImport_RejectsReversedWindow(t *testing.T) {
	name := "nightly"
	body := exceptionExportBody{
		PolicyName:    &name,
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(2 * time.Hour),
		EndsAt:        time.Now().Add(time.Hour),
	}
	msg, _ := validateExceptionImport(body)
	if msg == "" {
		t.Fatal("expected endsAt-before-startsAt to be rejected")
	}
}

// Both preview and apply must reject missing or blank parent policy names
// before attempting database lookup. The handler intentionally has no store.
func TestExceptionImportHandlers_RequireParentPolicy(t *testing.T) {
	h := &Handler{}
	for _, parent := range []struct {
		name    string
		value   interface{}
		include bool
	}{
		{"missing", nil, false},
		{"null", nil, true},
		{"empty", "", true},
		{"blank", " \t\n", true},
	} {
		for endpoint, handler := range map[string]http.HandlerFunc{
			"preview": h.previewExceptionImport,
			"apply":   h.applyExceptionImport,
		} {
			t.Run(parent.name+"/"+endpoint, func(t *testing.T) {
				ex := map[string]interface{}{
					"exceptionType": store.ExceptionTypeStayAwake,
					"startsAt":      time.Now().Add(time.Hour),
					"endsAt":        time.Now().Add(2 * time.Hour),
				}
				if parent.include {
					ex["policyName"] = parent.value
				}
				payload, err := json.Marshal(map[string]interface{}{"schemaVersion": exportSchemaVersion, "kind": exportKindException, "exception": ex})
				if err != nil {
					t.Fatal(err)
				}
				req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/exceptions/import/"+endpoint, strings.NewReader(string(payload)))
				res := httptest.NewRecorder()
				handler(res, req)
				if res.Code != http.StatusBadRequest {
					t.Fatalf("status = %d, want 400; body: %s", res.Code, res.Body.String())
				}
				if !strings.Contains(res.Body.String(), "policyName is required") {
					t.Errorf("unexpected rejection: %s", res.Body.String())
				}
			})
		}
	}
}

// TestGuardrailsBodyToUpdates_ContainsAllFields ensures every exported field
// has a corresponding update key — otherwise the import would silently drop
// a field on overwrite.
func TestGuardrailsBodyToUpdates_ContainsAllFields(t *testing.T) {
	updates := guardrailsBodyToUpdates(guardrailsExportBody{})
	expected := []string{
		"protected_namespaces", "skip_ns_node", "skip_node_labels", "skip_node_taints",
		"scaling_priority_namespaces", "scheduler_eval_interval", "scheduler_auto_wake",
		"scheduler_reconcile_while_awake", "scheduler_enforce_sleep", "scaling_concurrency",
		"wake_wave_size", "wake_wave_pause_seconds", "protect_critical_pod_nodes",
	}
	for _, key := range expected {
		if _, ok := updates[key]; !ok {
			t.Errorf("guardrailsBodyToUpdates missing key %q", key)
		}
	}
}

// Exporting guardrails and converting them into import updates must preserve
// every configurable value, including settings explicitly switched off.
func TestGuardrailsModelToBody_RoundTrip(t *testing.T) {
	// Enable one boolean at a time so swapping settings between fields cannot pass.
	tests := []struct {
		name                    string
		autoWake                bool
		reconcileWhileAwake     bool
		enforceSleep            bool
		protectCriticalPodNodes bool
	}{
		{name: "all boolean settings disabled"},
		{name: "automatic wake enabled", autoWake: true},
		{name: "awake reconciliation enabled", reconcileWhileAwake: true},
		{name: "sleep enforcement enabled", enforceSleep: true},
		{name: "critical pod node protection enabled", protectCriticalPodNodes: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := &store.Guardrails{
				ProtectedNamespaces:          "kube-system,monitoring",
				SkipNsNode:                   "monitoring",
				SkipNodeLabels:               "example.com/protected=true",
				SkipNodeTaints:               "dedicated=infra:NoSchedule",
				ScalingPriorityNamespaces:    "prod,staging",
				SchedulerEvalInterval:        "45s",
				SchedulerAutoWake:            tt.autoWake,
				SchedulerReconcileWhileAwake: tt.reconcileWhileAwake,
				SchedulerEnforceSleep:        tt.enforceSleep,
				ScalingConcurrency:           5,
				WakeWaveSize:                 3,
				WakeWavePauseSeconds:         12,
				ProtectCriticalPodNodes:      tt.protectCriticalPodNodes,
			}
			body := guardrailsModelToBody(g)
			updates := guardrailsBodyToUpdates(body)
			want := map[string]interface{}{
				"protected_namespaces":            "kube-system,monitoring",
				"skip_ns_node":                    "monitoring",
				"skip_node_labels":                "example.com/protected=true",
				"skip_node_taints":                "dedicated=infra:NoSchedule",
				"scaling_priority_namespaces":     "prod,staging",
				"scheduler_eval_interval":         "45s",
				"scheduler_auto_wake":             tt.autoWake,
				"scheduler_reconcile_while_awake": tt.reconcileWhileAwake,
				"scheduler_enforce_sleep":         tt.enforceSleep,
				"scaling_concurrency":             5,
				"wake_wave_size":                  3,
				"wake_wave_pause_seconds":         12,
				"protect_critical_pod_nodes":      tt.protectCriticalPodNodes,
			}
			if !reflect.DeepEqual(updates, want) {
				t.Errorf("guardrails round-trip updates = %#v, want %#v", updates, want)
			}
		})
	}
}
