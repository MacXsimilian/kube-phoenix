package store

import "testing"

// Namespace, label, and explicit target filters narrow each other. Matching one
// filter must not admit a workload excluded by another.
func TestExceptionTargetIntersection(t *testing.T) {
	exception := ScheduledException{
		NamespaceFilter: "a,b",
		LabelSelector:   "app=a",
		WorkloadTargets: `[{"kind":"Deployment","namespace":"a","name":"api"}]`,
	}
	tests := []struct {
		name         string
		namespace    string
		workloadName string
		appLabel     string
		wantMatch    bool
	}{
		{name: "all filters match", namespace: "a", workloadName: "api", appLabel: "a", wantMatch: true},
		{name: "different workload name", namespace: "a", workloadName: "other", appLabel: "a"},
		{name: "namespace outside explicit target", namespace: "b", workloadName: "api", appLabel: "a"},
		{name: "different app label", namespace: "a", workloadName: "api", appLabel: "b"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches, err := exception.Matches("Deployment", tt.namespace, tt.workloadName, map[string]string{"app": tt.appLabel})
			if err != nil {
				t.Fatalf("match exception target: %v", err)
			}
			if matches != tt.wantMatch {
				t.Errorf("Matches() = %v, want %v", matches, tt.wantMatch)
			}
		})
	}
}

// A valid explicit target still has to satisfy the exception's namespace filter.
// The parent allows this namespace, so rejection must come from the exception.
func TestExplicitTargetCannotBroadenExceptionNamespaceScope(t *testing.T) {
	exception := ScheduledException{
		NamespaceFilter: "a",
		LabelSelector:   "app=api",
		WorkloadTargets: `[{"kind":"Deployment","namespace":"b","name":"api"}]`,
	}
	parentPolicy := Policy{NamespaceFilter: "a,b", ExceptionScope: &exception}

	allowed, err := parentPolicy.AllowsExceptionTarget("Deployment", "b", "api", map[string]string{"app": "api"})
	if err != nil {
		t.Fatalf("check exception namespace scope: %v", err)
	}
	if allowed {
		t.Fatal("explicit target allowed a workload outside the exception's namespace filter")
	}
}

// An exception with only explicit targets is still scoped; treating it as
// unfiltered would allow scheduler and scaler paths to affect the full policy.
func TestExplicitTargetsCountAsTargetingFilters(t *testing.T) {
	exception := ScheduledException{
		WorkloadTargets: `[{"kind":"Deployment","namespace":"a","name":"api"}]`,
	}
	if !exception.HasTargetingFilters() {
		t.Fatal("explicit workload targets should count as targeting filters")
	}
}

// Even a complete exception match cannot select a namespace outside its parent
// policy. Exception filters are applied within the parent's target boundary.
func TestExceptionTargetCannotBroadenParentScope(t *testing.T) {
	exception := ScheduledException{
		NamespaceFilter: "a,b",
		LabelSelector:   "app=a",
		WorkloadTargets: `[{"kind":"Deployment","namespace":"a","name":"api"}]`,
	}
	parentPolicy := Policy{NamespaceFilter: "outside", ExceptionScope: &exception}

	allowed, err := parentPolicy.AllowsExceptionTarget("Deployment", "a", "api", map[string]string{"app": "a"})
	if err != nil {
		t.Fatalf("check parent scope: %v", err)
	}
	if allowed {
		t.Fatal("exception allowed a workload outside its parent policy's namespace")
	}
}

// Invalid targeting configuration must return an error instead of becoming an
// unrestricted match that could scale unintended workloads.
func TestInvalidTargetsFailClosed(t *testing.T) {
	tests := []struct {
		name      string
		exception ScheduledException
	}{
		{name: "invalid label selector", exception: ScheduledException{LabelSelector: "bad==="}},
		{name: "unsupported workload kind", exception: ScheduledException{WorkloadTargets: `[{"kind":"Pod","namespace":"a","name":"p"}]`}},
		{name: "malformed target JSON", exception: ScheduledException{WorkloadTargets: `{broken`}},
		{name: "missing namespace and name", exception: ScheduledException{WorkloadTargets: `[{"kind":"Deployment"}]`}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := tt.exception.Matches("Deployment", "a", "p", nil); err == nil {
				t.Fatal("expected invalid targeting configuration to be rejected")
			}
		})
	}
}
