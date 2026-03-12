package scaler

import (
	"context"
	"fmt"
	"strings"
)

// RunScaleDown scales all Deployments and StatefulSets to 0 (excluding skip namespaces)
// and drains + deletes non-protected nodes.
// namespaceFilter: comma-separated list of namespaces to target; empty = all.
func (r *Runner) RunScaleDown(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}

	skipNS := splitCSV(g.SkipNamespaces)
	skipNsNode := splitCSV(g.SkipNsNode)
	skipNodeLabels := splitCSV(g.SkipNodeLabels)
	skipNodeTaints := splitCSV(g.SkipNodeTaints)

	// ── Scale Deployments ──────────────────────────────────────────────────
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
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if d.Spec.Replicas != nil {
				replicas = *d.Spec.Replicas
			}
			wl := formatWorkload("Deployment", ns, name)

			// Save annotation if not already set
			_, alreadySaved := d.Annotations[annotationKey]
			if !alreadySaved {
				if isApply(mode) {
					if err := r.k8s.AnnotateDeployment(ctx, ns, name, annotationKey, fmt.Sprintf("%d", replicas)); err != nil {
						r.errLog(logCh, fmt.Sprintf("Failed to annotate %s: %s", wl, err))
						counts.Errors++
						continue
					}
					r.info(logCh, fmt.Sprintf("Saved replicas=%d for %s", replicas, wl))
				} else {
					r.plan(logCh, fmt.Sprintf("Would save replicas=%d for %s", replicas, wl))
				}
			}

			// Scale to 0
			if replicas == 0 {
				counts.Skipped++
				continue
			}
			if isApply(mode) {
				if err := r.k8s.ScaleDeployment(ctx, ns, name, 0); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Scaled %s → 0", wl))
			} else {
				r.plan(logCh, fmt.Sprintf("Would scale %s → 0", wl))
			}
			counts.Scaled++
		}
	}

	// ── Scale StatefulSets ─────────────────────────────────────────────────
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
				counts.Skipped++
				continue
			}
			replicas := int32(0)
			if ss.Spec.Replicas != nil {
				replicas = *ss.Spec.Replicas
			}
			wl := formatWorkload("StatefulSet", ns, name)

			_, alreadySaved := ss.Annotations[annotationKey]
			if !alreadySaved {
				if isApply(mode) {
					if err := r.k8s.AnnotateStatefulSet(ctx, ns, name, annotationKey, fmt.Sprintf("%d", replicas)); err != nil {
						r.errLog(logCh, fmt.Sprintf("Failed to annotate %s: %s", wl, err))
						counts.Errors++
						continue
					}
					r.info(logCh, fmt.Sprintf("Saved replicas=%d for %s", replicas, wl))
				} else {
					r.plan(logCh, fmt.Sprintf("Would save replicas=%d for %s", replicas, wl))
				}
			}

			if replicas == 0 {
				counts.Skipped++
				continue
			}
			if isApply(mode) {
				if err := r.k8s.ScaleStatefulSet(ctx, ns, name, 0); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Scaled %s → 0", wl))
			} else {
				r.plan(logCh, fmt.Sprintf("Would scale %s → 0", wl))
			}
			counts.Scaled++
		}
	}

	// ── Drain Nodes ────────────────────────────────────────────────────────
	r.info(logCh, "Fetching nodes...")
	nodes, err := r.k8s.ListNodes(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list nodes: "+err.Error())
		counts.Errors++
		return counts, nil
	}

	// Build set of nodes running critical pods
	r.info(logCh, "Identifying nodes with critical workloads...")
	allPods, err := r.k8s.ListAllPods(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list pods: "+err.Error())
		counts.Errors++
		return counts, nil
	}
	criticalNodes := map[string]bool{}
	for _, pod := range allPods {
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
	}

	for _, node := range nodes {
		name := node.Name

		// Check label protection
		labelProtected := false
		for _, kv := range strings.Split(g.SkipNodeLabels, ",") {
			kv = strings.TrimSpace(kv)
			if kv == "" {
				continue
			}
			parts := strings.SplitN(kv, "=", 2)
			if len(parts) != 2 {
				continue
			}
			if v, ok := node.Labels[parts[0]]; ok && v == parts[1] {
				labelProtected = true
				break
			}
		}

		// Check taint protection
		taintProtected := false
		for _, kv := range strings.Split(g.SkipNodeTaints, ",") {
			kv = strings.TrimSpace(kv)
			if kv == "" {
				continue
			}
			for _, taint := range node.Spec.Taints {
				taintStr := fmt.Sprintf("%s=%s:%s", taint.Key, taint.Value, taint.Effect)
				if taintStr == kv {
					taintProtected = true
					break
				}
			}
		}

		if labelProtected || taintProtected {
			r.info(logCh, fmt.Sprintf("Protected node %s (label/taint match)", name))
			continue
		}

		if criticalNodes[name] {
			r.info(logCh, fmt.Sprintf("Protected node %s (running critical workload)", name))
			continue
		}

		if isApply(mode) {
			r.info(logCh, fmt.Sprintf("Draining node %s...", name))
			if err := r.k8s.DrainNode(ctx, name); err != nil {
				r.errLog(logCh, fmt.Sprintf("Drain failed for %s: %s", name, err))
				counts.Errors++
				continue
			}
			r.ok(logCh, fmt.Sprintf("Drained node %s", name))
			counts.Drained++

			if err := r.k8s.DeleteNode(ctx, name); err != nil {
				r.errLog(logCh, fmt.Sprintf("Failed to delete node %s: %s", name, err))
				counts.Errors++
			} else {
				r.ok(logCh, fmt.Sprintf("Deleted node object %s", name))
				counts.Deleted++
			}
		} else {
			r.plan(logCh, fmt.Sprintf("Would drain node %s", name))
			r.plan(logCh, fmt.Sprintf("Would delete node object %s", name))
			counts.Drained++
			counts.Deleted++
		}
	}

	return counts, nil
}
