package scaler

import (
	"context"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func TestBuildSnapshotedSet(t *testing.T) {
	snaps := []store.WorkloadSnapshot{
		{Kind: "Deployment", Namespace: "ns-a", Name: "web"},
		{Kind: "StatefulSet", Namespace: "ns-b", Name: "db"},
	}
	set := buildSnapshotedSet(snaps)

	if !set["Deployment/ns-a/web"] {
		t.Error("expected Deployment/ns-a/web in set")
	}
	if !set["StatefulSet/ns-b/db"] {
		t.Error("expected StatefulSet/ns-b/db in set")
	}
	if set["Deployment/ns-c/missing"] {
		t.Error("unexpected key in set")
	}
}

func TestBuildSnapshotedSet_Empty(t *testing.T) {
	set := buildSnapshotedSet(nil)
	if len(set) != 0 {
		t.Errorf("expected empty set, got %d entries", len(set))
	}
}

func TestRestoreFromAnnotation_NoAnnotation(t *testing.T) {
	logCh := make(chan LogLine, 10)
	counts := &Counts{}
	e := workloadEntry{
		Kind: "Deployment", Namespace: "ns", Name: "web",
		Annotations: map[string]string{},
	}

	restored := (&PolicyRunner{}).restoreFromAnnotation(context.Background(), e, logCh, counts)

	if restored {
		t.Error("expected no restore when annotation is missing")
	}
	if counts.Scaled != 0 || counts.Errors != 0 {
		t.Errorf("counts should be untouched, got scaled=%d errors=%d", counts.Scaled, counts.Errors)
	}
}

func TestRestoreFromAnnotation_InvalidAnnotation_LogsWarning(t *testing.T) {
	logCh := make(chan LogLine, 10)
	counts := &Counts{}
	e := workloadEntry{
		Kind: "Deployment", Namespace: "ns", Name: "web",
		Annotations: map[string]string{annotationKey: "not-a-number"},
	}

	restored := (&PolicyRunner{}).restoreFromAnnotation(context.Background(), e, logCh, counts)

	if restored {
		t.Error("expected no restore for invalid annotation")
	}

	select {
	case line := <-logCh:
		if line.Level != "warn" {
			t.Errorf("expected warn log for parse error, got %q: %s", line.Level, line.Message)
		}
	default:
		t.Error("expected a warning log line for invalid annotation parse error")
	}
}

func TestRestoreFromAnnotation_ZeroTarget_Skipped(t *testing.T) {
	logCh := make(chan LogLine, 10)
	counts := &Counts{}
	e := workloadEntry{
		Kind: "Deployment", Namespace: "ns", Name: "web",
		Annotations: map[string]string{annotationKey: "0"},
	}

	restored := (&PolicyRunner{}).restoreFromAnnotation(context.Background(), e, logCh, counts)

	if restored {
		t.Error("expected no restore for target=0")
	}
}

func TestRestoreFromAnnotation_NegativeTarget_Skipped(t *testing.T) {
	logCh := make(chan LogLine, 10)
	counts := &Counts{}
	e := workloadEntry{
		Kind: "Deployment", Namespace: "ns", Name: "web",
		Annotations: map[string]string{annotationKey: "-5"},
	}

	restored := (&PolicyRunner{}).restoreFromAnnotation(context.Background(), e, logCh, counts)

	if restored {
		t.Error("expected no restore for negative target")
	}
}
