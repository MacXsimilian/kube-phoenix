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
		if p.ExceptionScope == nil || direction == "wake" || p.ExceptionScope.ExceptionType != store.ExceptionTypeForceSleep {
			effective := ""
			for _, ex := range exceptions {
				matches, err := ex.Matches(entry.Kind, entry.Namespace, entry.Name, entry.Labels)
				if err != nil {
					return nil, err
				}
				if !matches {
					continue
				}
				if ex.ExceptionType == store.ExceptionTypeForceSleep {
					effective = ex.ExceptionType
					break
				}
				if ex.ExceptionType == store.ExceptionTypeStayAwake {
					effective = ex.ExceptionType
				}
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
