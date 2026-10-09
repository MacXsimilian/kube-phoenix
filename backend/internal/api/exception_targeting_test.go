package api

import (
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// Create and update must reject the same invalid workload targets. Otherwise an
// edit could bypass the validation applied when the exception was first created.
func TestExceptionAPIsRejectInvalidTargets(t *testing.T) {
	policyID := uint(1)
	now := time.Now()
	tests := []struct {
		name   string
		target store.WorkloadTarget
	}{
		{name: "unsupported workload kind", target: store.WorkloadTarget{Kind: "Pod", Namespace: "test", Name: "a"}},
		{name: "missing namespace", target: store.WorkloadTarget{Kind: "Deployment", Name: "a"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := exceptionInput{
				// A valid parent and future window isolate target validation failures.
				PolicyID:        &policyID,
				ExceptionType:   store.ExceptionTypeForceSleep,
				StartsAt:        now.Add(time.Hour),
				EndsAt:          now.Add(2 * time.Hour),
				WorkloadTargets: []store.WorkloadTarget{tt.target},
			}
			t.Run("create", func(t *testing.T) {
				if err := validateExceptionInput(input); err == nil {
					t.Fatal("create accepted an invalid workload target")
				}
			})
			t.Run("update", func(t *testing.T) {
				update := exceptionUpdateInput{WorkloadTargets: input.WorkloadTargets}
				if _, err := buildExceptionUpdates(update); err == nil {
					t.Fatal("update accepted an invalid workload target")
				}
			})
		})
	}
}

// An explicit empty array means clear existing targets. Persisting [] preserves
// that intent instead of treating the field as omitted from the update.
func TestExceptionUpdateClearsTargets(t *testing.T) {
	updates, err := buildExceptionUpdates(exceptionUpdateInput{WorkloadTargets: []store.WorkloadTarget{}})
	if err != nil {
		t.Fatalf("clear workload targets: %v", err)
	}
	if got := updates["workload_targets"]; got != "[]" {
		t.Errorf("workload_targets = %v, want []", got)
	}
}

// Reject malformed selectors at the API boundary before the scheduler attempts
// to use them to select workloads.
func TestExceptionUpdateRejectsInvalidLabelSelector(t *testing.T) {
	invalidSelector := "app==="
	if _, err := buildExceptionUpdates(exceptionUpdateInput{LabelSelector: &invalidSelector}); err == nil {
		t.Fatal("update accepted an invalid label selector")
	}
}
