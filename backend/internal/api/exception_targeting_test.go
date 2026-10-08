package api

import (
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func TestExceptionAPIsValidateAndClearTargets(t *testing.T) {
	id := uint(1)
	for _, target := range []store.WorkloadTarget{{Kind: "Pod", Namespace: "test", Name: "a"}, {Kind: "Deployment", Name: "a"}} {
		input := exceptionInput{PolicyID: &id, ExceptionType: store.ExceptionTypeForceSleep, StartsAt: time.Now().Add(time.Hour), EndsAt: time.Now().Add(2 * time.Hour), WorkloadTargets: []store.WorkloadTarget{target}}
		if err := validateExceptionInput(input); err == nil {
			t.Fatal("create accepted invalid target")
		}
		if _, err := buildExceptionUpdates(exceptionUpdateInput{WorkloadTargets: input.WorkloadTargets}); err == nil {
			t.Fatal("update accepted invalid target")
		}
	}
	updates, err := buildExceptionUpdates(exceptionUpdateInput{WorkloadTargets: []store.WorkloadTarget{}})
	if err != nil || updates["workload_targets"] != "[]" {
		t.Fatalf("clear targets: %v %v", updates, err)
	}
	bad := "app==="
	if _, err := buildExceptionUpdates(exceptionUpdateInput{LabelSelector: &bad}); err == nil {
		t.Fatal("invalid selector accepted")
	}
}
