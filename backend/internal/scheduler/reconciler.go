package scheduler

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const reconcileInterval = 15 * time.Minute

// Reconcile checks actual cluster state against desired policy state and
// fires corrective executions if needed. Called at startup and on the drift ticker.
func (s *Scheduler) Reconcile(ctx context.Context) {
	slog.Info("reconciler: starting desired-state reconciliation")

	if s.runner == nil {
		slog.Info("reconciler: no k8s client — skipping reconciliation")
		return
	}

	policies, err := s.store.ListSleepPolicies()
	if err != nil {
		slog.Error("reconciler: failed to list policies", "err", err)
		return
	}

	// Get all namespaces from the cluster
	namespaces, err := s.runner.ListNamespaces(ctx)
	if err != nil {
		slog.Error("reconciler: failed to list namespaces", "err", err)
		return
	}

	now := time.Now()

	for _, ns := range namespaces {
		nsName := ns.Name

		// Find governing policies for this namespace
		var governing []store.SleepPolicy
		for _, p := range policies {
			if !p.Enabled {
				continue
			}
			if namespaceMatchesFilter(nsName, p.NamespaceFilter) {
				governing = append(governing, p)
			}
		}

		// No governing policy → unmanaged, skip
		if len(governing) == 0 {
			continue
		}

		// Compute desired state: SLEEP unless any policy says awake
		// "Awake wins" rule
		desiredAwake := false
		var awakePolicy *store.SleepPolicy
		for i := range governing {
			if isAwakeNow(governing[i], now) {
				desiredAwake = true
				awakePolicy = &governing[i]
				break
			}
		}

		// Check actual state: are all deployments/statefulsets at 0 replicas?
		actualSleeping, err := s.runner.IsNamespaceSleeping(ctx, nsName)
		if err != nil {
			slog.Warn("reconciler: failed to check namespace state", "namespace", nsName, "err", err)
			continue
		}

		if desiredAwake && actualSleeping {
			slog.Info("reconciler: drift detected — namespace should be awake", "namespace", nsName)
			s.applyDriftCorrection(ctx, nsName, "wake", awakePolicy)
		} else if !desiredAwake && !actualSleeping {
			slog.Info("reconciler: drift detected — namespace should be sleeping", "namespace", nsName)
			// Use the first governing policy for the correction
			s.applyDriftCorrection(ctx, nsName, "sleep", &governing[0])
		}
	}

	slog.Info("reconciler: reconciliation complete")
}

// applyDriftCorrection fires a corrective execution.
func (s *Scheduler) applyDriftCorrection(ctx context.Context, namespace, edge string, policy *store.SleepPolicy) {
	if policy == nil {
		return
	}

	if policy.DriftCorrectionMode == "silent" {
		// Apply silently: no execution record, no notification
		slog.Info("reconciler: silent drift correction", "namespace", namespace, "edge", edge, "policyID", policy.ID)
		// Create a temporary single-namespace scoped policy to run the correction
		tempPolicy := *policy
		tempPolicy.NamespaceFilter = namespace
		var err error
		switch edge {
		case "wake":
			_, err = s.runner.RunScaleUpSilent(ctx, &tempPolicy, nil)
		case "sleep":
			_, err = s.runner.RunScaleDownSilent(ctx, &tempPolicy, nil)
		}
		if err != nil {
			slog.Error("reconciler: silent drift correction failed", "namespace", namespace, "edge", edge, "err", err)
		}
		return
	}

	// Record mode: create an execution
	var scheduleType string
	switch edge {
	case "wake":
		scheduleType = "scale_up"
	case "sleep":
		scheduleType = "scale_down"
	}

	// Scope the correction to this namespace only
	scopedPolicy := *policy
	scopedPolicy.NamespaceFilter = namespace

	execID, err := s.runPolicy(ctx, &scopedPolicy, scheduleType, "drift_correction")
	if err != nil {
		slog.Error("reconciler: drift correction execution failed", "namespace", namespace, "edge", edge, "err", err)
		return
	}

	s.notifySvc.NotifyDriftCorrected(execID, &policy.ID, namespace)
	slog.Info("reconciler: drift correction started", "execID", execID, "namespace", namespace, "edge", edge)
}

// StartDriftTicker runs Reconcile every 15 minutes in the background.
func (s *Scheduler) StartDriftTicker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(reconcileInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.Reconcile(ctx)
			}
		}
	}()
}

// namespaceMatchesFilter returns true if the namespace is covered by the filter.
// Empty filter = all namespaces.
func namespaceMatchesFilter(ns, filter string) bool {
	if filter == "" {
		return true
	}
	for _, f := range strings.Split(filter, ",") {
		if strings.TrimSpace(f) == ns {
			return true
		}
	}
	return false
}
