// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// TestGuardrailsExport_StripsPersistenceMetadata verifies the export body
// omits id and updatedAt — the fields the design decision says must not
// travel cross-environment.
func TestGuardrailsExport_StripsPersistenceMetadata(t *testing.T) {
	body := guardrailsExportBody{SystemNamespaces: "kube-system"}
	export := guardrailsExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindGuardrails,
		Guardrails:    body,
	}
	raw, err := json.Marshal(export)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, banned := range []string{`"id"`, `"updatedAt"`} {
		if strings.Contains(string(raw), banned) {
			t.Errorf("guardrails export must not contain %s, got: %s", banned, raw)
		}
	}
}

// TestPolicyExport_StripsDerivedState verifies the policy export body omits
// id, derived state, and persistence timestamps.
func TestPolicyExport_StripsDerivedState(t *testing.T) {
	body := policyExportBody{
		Name:         "nightly",
		Mode:         store.PolicyModePlan,
		SleepWindows: []policy.SleepWindow{{DaysOfWeek: []int{1}, StartTime: "20:00", EndTime: "08:00"}},
	}
	raw, err := json.Marshal(policyExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindPolicy,
		Policy:        body,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	banned := []string{`"id"`, `"currentState"`, `"stateSince"`, `"lastSleepAt"`,
		`"lastWakeAt"`, `"nextTransitionAt"`, `"createdAt"`, `"updatedAt"`}
	for _, b := range banned {
		if strings.Contains(string(raw), b) {
			t.Errorf("policy export must not contain %s, got: %s", b, raw)
		}
	}
}

// TestExceptionExport_StripsLifecycleFields verifies the exception export
// body omits id, status, lifecycle execution IDs, and the policy FK (replaced
// by policyName).
func TestExceptionExport_StripsLifecycleFields(t *testing.T) {
	name := "staging"
	body := exceptionExportBody{
		PolicyName:    &name,
		ExceptionType: store.ExceptionTypeStayAwake,
		StartsAt:      time.Now().Add(time.Hour),
		EndsAt:        time.Now().Add(2 * time.Hour),
	}
	raw, err := json.Marshal(exceptionExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindException,
		Exception:     body,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	banned := []string{`"id"`, `"policyId"`, `"status"`, `"startExecutionId"`,
		`"endExecutionId"`, `"cancelledAt"`, `"cancelReason"`, `"createdBy"`,
		`"createdAt"`, `"updatedAt"`}
	for _, b := range banned {
		if strings.Contains(string(raw), b) {
			t.Errorf("exception export must not contain %s, got: %s", b, raw)
		}
	}
	if !strings.Contains(string(raw), `"policyName"`) {
		t.Errorf("exception export must reference parent by policyName, got: %s", raw)
	}
}

// TestPolicyModelToBody_OmitsDerivedFields verifies the model→body conversion
// drops every persistence/derived field; only configurable fields survive.
func TestPolicyModelToBody_OmitsDerivedFields(t *testing.T) {
	now := time.Now()
	p := &store.Policy{
		ID:               42,
		Name:             "n",
		Mode:             store.PolicyModePlan,
		Enabled:          true,
		CurrentState:     store.PolicyStateAwake,
		StateSince:       &now,
		LastSleepAt:      &now,
		LastWakeAt:       &now,
		NextTransitionAt: &now,
		CreatedAt:        now,
		UpdatedAt:        now,
		SleepWindows:     `[{"daysOfWeek":[1],"startTime":"20:00","endTime":"08:00","allDay":false}]`,
	}
	body := policyModelToBody(p)
	if body.Name != "n" {
		t.Errorf("Name = %q, want %q", body.Name, "n")
	}
	if got := len(body.SleepWindows); got != 1 {
		t.Errorf("sleepWindows count = %d, want 1", got)
	}
	// The body struct doesn't even have fields for id/currentState/etc, so
	// the contract is checked at compile-time. This assertion guards against
	// someone re-adding them by mistake.
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, banned := range []string{`"id"`, `"currentState"`, `"createdAt"`} {
		if strings.Contains(string(raw), banned) {
			t.Errorf("policyModelToBody must not surface %s, got: %s", banned, raw)
		}
	}
}
