package store

import "testing"

func TestExceptionTargetIntersection(t *testing.T) {
	ex := ScheduledException{NamespaceFilter: "a,b", LabelSelector: "app=a", WorkloadTargets: `[{"kind":"Deployment","namespace":"a","name":"api"}]`}
	if !(&ScheduledException{WorkloadTargets: ex.WorkloadTargets}).HasTargetingFilters() {
		t.Fatal("explicit targets not recognized")
	}
	for _, tc := range []struct {
		ns, name, label string
		want            bool
	}{{"a", "api", "a", true}, {"a", "other", "a", false}, {"b", "api", "a", false}, {"a", "api", "b", false}} {
		got, err := ex.Matches("Deployment", tc.ns, tc.name, map[string]string{"app": tc.label})
		if err != nil || got != tc.want {
			t.Fatalf("%+v: %v %v", tc, got, err)
		}
	}
	p := Policy{NamespaceFilter: "outside", ExceptionScope: &ex}
	if got, _ := p.AllowsExceptionTarget("Deployment", "a", "api", map[string]string{"app": "a"}); got {
		t.Fatal("scope broadened parent")
	}
}

func TestInvalidTargetsFailClosed(t *testing.T) {
	for _, ex := range []ScheduledException{{LabelSelector: "bad==="}, {WorkloadTargets: `[{"kind":"Pod","namespace":"a","name":"p"}]`}, {WorkloadTargets: `{broken`}, {WorkloadTargets: `[{"kind":"Deployment"}]`}} {
		if _, err := ex.Matches("Deployment", "a", "p", nil); err == nil {
			t.Fatalf("accepted %+v", ex)
		}
	}
}
