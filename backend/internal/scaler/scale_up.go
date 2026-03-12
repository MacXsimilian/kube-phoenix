package scaler

import (
	"context"
	"fmt"
	"strconv"
)

// RunScaleUp restores Deployments and StatefulSets from the previous-replicas annotation.
// Nodes are expected to be re-provisioned by Karpenter automatically.
// namespaceFilter: comma-separated list of namespaces to target; empty = all.
func (r *Runner) RunScaleUp(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}
	skipNS := splitCSV(g.SkipNamespaces)

	// ── Restore Deployments ────────────────────────────────────────────────
	r.info(logCh, "Fetching Deployments...")
	deployments, err := r.k8s.ListDeployments(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list deployments: "+err.Error())
		counts.Errors++
	} else {
		for _, d := range deployments {
			ns := d.Namespace
			name := d.Name
			if skipNS[ns] || !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			savedStr, ok := d.Annotations[annotationKey]
			if !ok {
				counts.Skipped++
				continue
			}
			saved, err := strconv.ParseInt(savedStr, 10, 32)
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Invalid annotation on Deployment %s/%s: %s", ns, name, savedStr))
				counts.Errors++
				continue
			}
			wl := formatWorkload("Deployment", ns, name)

			if isApply(mode) {
				if err := r.k8s.ScaleDeployment(ctx, ns, name, int32(saved)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, saved))
				if err := r.k8s.RemoveDeploymentAnnotation(ctx, ns, name, annotationKey); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, saved))
			}
			counts.Scaled++
		}
	}

	// ── Restore StatefulSets ───────────────────────────────────────────────
	r.info(logCh, "Fetching StatefulSets...")
	statefulsets, err := r.k8s.ListStatefulSets(ctx, "")
	if err != nil {
		r.errLog(logCh, "Failed to list statefulsets: "+err.Error())
		counts.Errors++
	} else {
		for _, ss := range statefulsets {
			ns := ss.Namespace
			name := ss.Name
			if skipNS[ns] || !namespaceAllowed(ns, namespaceFilter) {
				continue
			}
			savedStr, ok := ss.Annotations[annotationKey]
			if !ok {
				counts.Skipped++
				continue
			}
			saved, err := strconv.ParseInt(savedStr, 10, 32)
			if err != nil {
				r.errLog(logCh, fmt.Sprintf("Invalid annotation on StatefulSet %s/%s: %s", ns, name, savedStr))
				counts.Errors++
				continue
			}
			wl := formatWorkload("StatefulSet", ns, name)

			if isApply(mode) {
				if err := r.k8s.ScaleStatefulSet(ctx, ns, name, int32(saved)); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, saved))
				if err := r.k8s.RemoveStatefulSetAnnotation(ctx, ns, name, annotationKey); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
				}
			} else {
				r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, saved))
			}
			counts.Scaled++
		}
	}

	r.info(logCh, fmt.Sprintf("Wake complete — restored %d workloads, %d errors", counts.Scaled, counts.Errors))
	return counts, nil
}
