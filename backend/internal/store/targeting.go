package store

import (
	"fmt"

	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/validation"
)

// ValidateExceptionTargets is shared by API input, imports, and execution.
func ValidateExceptionTargets(selector string, targets []WorkloadTarget) error {
	if _, err := labels.Parse(selector); err != nil {
		return fmt.Errorf("invalid labelSelector: %w", err)
	}
	for _, target := range targets {
		if target.Kind != "Deployment" && target.Kind != "StatefulSet" {
			return fmt.Errorf("unsupported workload target kind %q", target.Kind)
		}
		if len(validation.IsDNS1123Label(target.Namespace)) > 0 || len(validation.IsDNS1123Subdomain(target.Name)) > 0 {
			return fmt.Errorf("workload target requires a valid namespace and name")
		}
	}
	return nil
}

// Matches uses intersection across namespaces, labels and explicit targets;
// entries within each namespace/target list are alternatives.
func (e ScheduledException) Matches(kind, namespace, name string, workloadLabels map[string]string) (bool, error) {
	targets, err := e.GetWorkloadTargets()
	if err != nil {
		return false, err
	}
	if err := ValidateExceptionTargets(e.LabelSelector, targets); err != nil {
		return false, err
	}
	if e.NamespaceFilter != "" && !stringutil.SplitCSVSet(e.NamespaceFilter)[namespace] {
		return false, nil
	}
	selector, err := labels.Parse(e.LabelSelector)
	if err != nil {
		return false, err
	}
	if !selector.Matches(labels.Set(workloadLabels)) {
		return false, nil
	}
	if len(targets) == 0 {
		return true, nil
	}
	for _, target := range targets {
		if target.Kind == kind && target.Namespace == namespace && target.Name == name {
			return true, nil
		}
	}
	return false, nil
}

func (p Policy) AllowsExceptionTarget(kind, namespace, name string, workloadLabels map[string]string) (bool, error) {
	if p.ExceptionScope == nil {
		return true, nil
	}
	parent := ScheduledException{NamespaceFilter: p.NamespaceFilter, LabelSelector: p.LabelSelector}
	allowed, err := parent.Matches(kind, namespace, name, workloadLabels)
	if err != nil || !allowed {
		return false, err
	}
	return p.ExceptionScope.Matches(kind, namespace, name, workloadLabels)
}
