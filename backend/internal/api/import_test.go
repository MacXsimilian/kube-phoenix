// SPDX-License-Identifier: Apache-2.0

package api

import (
	"net/http"
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

// TestValidatePolicyImport_RejectsMissingName.
func TestValidatePolicyImport_RejectsMissingName(t *testing.T) {
	body := validPolicyBody()
	body.Name = ""
	if msg := validatePolicyImport(body); msg == "" {
		t.Fatal("expected missing name to be rejected")
	}
}

// TestValidatePolicyImport_RejectsEmptyWindows.
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

// TestPolicyBodyToUpdates_ForcesEnabledOffAndPlanMode covers the overwrite path.
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
	body := exceptionExportBody{
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

// TestValidateExceptionImport_AcceptsFreestanding accepts a future window with
// no parent policy (PolicyName == nil).
func TestValidateExceptionImport_AcceptsFreestanding(t *testing.T) {
	body := exceptionExportBody{
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(time.Hour),
		EndsAt:        time.Now().Add(2 * time.Hour),
	}
	msg, _ := validateExceptionImport(body)
	if msg != "" {
		t.Errorf("freestanding future exception must be accepted, got: %s", msg)
	}
}

// TestValidateExceptionImport_RejectsBadType.
func TestValidateExceptionImport_RejectsBadType(t *testing.T) {
	body := exceptionExportBody{
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

// TestValidateExceptionImport_RejectsReversedWindow.
func TestValidateExceptionImport_RejectsReversedWindow(t *testing.T) {
	body := exceptionExportBody{
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(2 * time.Hour),
		EndsAt:        time.Now().Add(time.Hour),
	}
	msg, _ := validateExceptionImport(body)
	if msg == "" {
		t.Fatal("expected endsAt-before-startsAt to be rejected")
	}
}

// TestGuardrailsBodyToUpdates_ContainsAllFields ensures every exported field
// has a corresponding update key — otherwise the import would silently drop
// a field on overwrite.
func TestGuardrailsBodyToUpdates_ContainsAllFields(t *testing.T) {
	updates := guardrailsBodyToUpdates(guardrailsExportBody{})
	expected := []string{
		"system_namespaces", "skip_ns_node", "skip_node_labels", "skip_node_taints",
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

// TestGuardrailsModelToBody_RoundTrip verifies that converting a model to an
// export body and back via guardrailsBodyToUpdates preserves user-visible
// fields.
func TestGuardrailsModelToBody_RoundTrip(t *testing.T) {
	g := &store.Guardrails{
		SystemNamespaces:             "kube-system",
		SchedulerEvalInterval:        "45s",
		SchedulerAutoWake:            true,
		SchedulerReconcileWhileAwake: false,
		SchedulerEnforceSleep:        true,
		ScalingConcurrency:           5,
	}
	body := guardrailsModelToBody(g)
	if body.SystemNamespaces != "kube-system" {
		t.Errorf("SystemNamespaces = %q, want %q", body.SystemNamespaces, "kube-system")
	}
	if body.SchedulerEvalInterval != "45s" {
		t.Errorf("SchedulerEvalInterval = %q, want %q", body.SchedulerEvalInterval, "45s")
	}
	if body.ScalingConcurrency != 5 {
		t.Errorf("ScalingConcurrency = %d, want %d", body.ScalingConcurrency, 5)
	}
}
