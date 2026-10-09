package scaler

import (
	"context"
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func (r *PolicyRunner) filterEntries(p store.Policy, entries []workloadEntry, direction string) ([]workloadEntry, error) {
	exceptions, err := r.store.ListActiveExceptionsForPolicy(p.ID, time.Now())
	if err != nil {
		return nil, fmt.Errorf("read active exception protections: %w", err)
	}
	var result []workloadEntry
	for _, entry := range entries {
		allowed, err := p.AllowsExceptionTarget(entry.Kind, entry.Namespace, entry.Name, entry.Labels)
		if err != nil {
			return nil, err
		}
		if !allowed {
			continue
		}
		// An explicit exception operation has already been selected by the
		// scheduler. Ordinary operations preserve active opposite exceptions.
		forceSleepSelected := p.ExceptionScope != nil && p.ExceptionScope.ExceptionType == store.ExceptionTypeForceSleep
		if !forceSleepSelected || direction == "wake" {
			effective, err := effectiveExceptionType(entry, exceptions)
			if err != nil {
				return nil, err
			}
			blocked := (direction == "sleep" && effective == store.ExceptionTypeStayAwake) || (direction == "wake" && effective == store.ExceptionTypeForceSleep)
			if blocked {
				continue
			}
		}
		result = append(result, entry)
	}
	return result, nil
}

// effectiveExceptionType returns the highest-priority matching exception.
// Force-sleep takes precedence over stay-awake, regardless of input order.
func effectiveExceptionType(entry workloadEntry, exceptions []store.ScheduledException) (string, error) {
	effective := ""
	for _, exception := range exceptions {
		matches, err := exception.Matches(entry.Kind, entry.Namespace, entry.Name, entry.Labels)
		if err != nil {
			return "", err
		}
		if !matches {
			continue
		}
		if exception.ExceptionType == store.ExceptionTypeForceSleep {
			return exception.ExceptionType, nil
		}
		if exception.ExceptionType == store.ExceptionTypeStayAwake {
			effective = exception.ExceptionType
		}
	}
	return effective, nil
}

func (r *PolicyRunner) filterWakeSnapshots(ctx context.Context, p store.Policy, snaps []store.WorkloadSnapshot) ([]store.WorkloadSnapshot, error) {
	// Full-policy restoration follows durable ownership, even after labels change.
	exceptions, err := r.store.ListActiveExceptionsForPolicy(p.ID, time.Now())
	if err != nil {
		return nil, err
	}
	if p.ExceptionScope == nil && len(exceptions) == 0 {
		return snaps, nil
	}
	var result []store.WorkloadSnapshot
	for _, snap := range snaps {
		entry, err := r.lookupEntry(ctx, snap.Kind, snap.Namespace, snap.Name)
		if err != nil {
			return nil, err
		}
		if entry == nil {
			// Only a full wake may close a deleted target without live labels.
			if p.ExceptionScope == nil {
				result = append(result, snap)
			}
			continue
		}
		allowed, err := r.filterEntries(p, []workloadEntry{*entry}, "wake")
		if err != nil {
			return nil, err
		}
		if len(allowed) > 0 {
			result = append(result, snap)
		}
	}
	return result, nil
}
