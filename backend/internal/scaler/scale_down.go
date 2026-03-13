package scaler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// RunScaleDown scales all Deployments and StatefulSets governed by the policy to 0
// (or min_replicas if the policy guardrail sets a floor > 0).
// Workload state is persisted to workload_snapshots — no annotations are written.
func (r *Runner) RunScaleDown(ctx context.Context, policy *store.SleepPolicy, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}

	// Load per-policy guardrails
	var pg *store.PolicyGuardrails
	if policy != nil {
		pg, _ = r.store.GetPolicyGuardrails(policy.ID)
	}

	// Build skip sets (guardrail evaluation order per FR-59):
	// global skip_namespaces → global node rules → policy skip_workloads → policy skip_namespaces → policy min_replicas → policy node rules
	globalSkipNS := splitCSV(g.SkipNamespaces)
	globalSkipNsNode := splitCSV(g.SkipNsNode)

	var policySkipWorkloads map[string]bool
	var policySkipNS map[string]bool
	minReplicas := 0
	if pg != nil {
		policySkipWorkloads = splitCSV(pg.SkipWorkloads)
		policySkipNS = splitCSV(pg.SkipNamespaces)
		minReplicas = pg.MinReplicas
	}

	// Collect the execution ID for snapshot linking.
	// On first scale-down, we create an execution record in the scheduler before calling here,
	// but we need the ID. We pass it via the context to keep the function signature stable.
	// Since we don't have it here, we store it via the store after the fact — snapshots are
	// created during the run and updated with the execution ID by the scheduler.
	// For now, use a placeholder (0) and let the snapshot be linked via policy_id.
	// The execution record links back via sleep_execution_id which is set by RunScaleDownWithExecID.

	namespaceFilter := ""
	if policy != nil {
		namespaceFilter = policy.NamespaceFilter
	}
	mode := "plan"
	if policy != nil {
		mode = policy.Mode
	}

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

			// FR-59 evaluation order
			// 1. Global skip_namespaces
			if globalSkipNS[ns] {
				counts.Skipped++
				continue
			}
			// 2. Namespace filter
			if !namespaceAllowed(ns, namespaceFilter) {
				counts.Skipped++
				continue
			}
			// 3. Policy skip_workloads
			if policySkipWorkloads[name] {
				r.info(logCh, fmt.Sprintf("Skipping %s (policy skip_workloads)", formatWorkload("Deployment", ns, name)))
				counts.Skipped++
				continue
			}
			// 4. Policy skip_namespaces
			if policySkipNS[ns] {
				r.info(logCh, fmt.Sprintf("Skipping %s (policy skip_namespaces)", formatWorkload("Deployment", ns, name)))
				counts.Skipped++
				continue
			}

			replicas := int32(0)
			if d.Spec.Replicas != nil {
				replicas = *d.Spec.Replicas
			}
			wl := formatWorkload("Deployment", ns, name)

			// FR-33: skip workloads already at 0 (or at min_replicas floor)
			targetReplicas := int32(minReplicas) // 5. policy min_replicas
			if replicas <= targetReplicas {
				counts.Skipped++
				continue
			}

			if isApply(mode) {
				// FR-32: snapshot before scaling (no annotation)
				snap := &store.WorkloadSnapshot{
					SleepExecutionID: 0, // will be updated by caller after execution is created
					Namespace:        ns,
					WorkloadName:     name,
					WorkloadKind:     "Deployment",
					ReplicasBefore:   int(replicas),
					SnapshottedAt:    time.Now(),
				}
				if policy != nil {
					snap.PolicyID = &policy.ID
				}
				if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to snapshot %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.info(logCh, fmt.Sprintf("Snapshotted replicas=%d for %s", replicas, wl))

				if err := r.k8s.ScaleDeployment(ctx, ns, name, targetReplicas); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Scaled %s → %d", wl, targetReplicas))
			} else {
				r.plan(logCh, fmt.Sprintf("Would snapshot replicas=%d for %s", replicas, wl))
				r.plan(logCh, fmt.Sprintf("Would scale %s → %d", wl, targetReplicas))
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

			// FR-59 evaluation order
			if globalSkipNS[ns] {
				counts.Skipped++
				continue
			}
			if !namespaceAllowed(ns, namespaceFilter) {
				counts.Skipped++
				continue
			}
			if policySkipWorkloads[name] {
				r.info(logCh, fmt.Sprintf("Skipping %s (policy skip_workloads)", formatWorkload("StatefulSet", ns, name)))
				counts.Skipped++
				continue
			}
			if policySkipNS[ns] {
				r.info(logCh, fmt.Sprintf("Skipping %s (policy skip_namespaces)", formatWorkload("StatefulSet", ns, name)))
				counts.Skipped++
				continue
			}

			replicas := int32(0)
			if ss.Spec.Replicas != nil {
				replicas = *ss.Spec.Replicas
			}
			wl := formatWorkload("StatefulSet", ns, name)

			targetReplicas := int32(minReplicas)
			if replicas <= targetReplicas {
				counts.Skipped++
				continue
			}

			if isApply(mode) {
				snap := &store.WorkloadSnapshot{
					SleepExecutionID: 0,
					Namespace:        ns,
					WorkloadName:     name,
					WorkloadKind:     "StatefulSet",
					ReplicasBefore:   int(replicas),
					SnapshottedAt:    time.Now(),
				}
				if policy != nil {
					snap.PolicyID = &policy.ID
				}
				if err := r.store.CreateWorkloadSnapshot(snap); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to snapshot %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.info(logCh, fmt.Sprintf("Snapshotted replicas=%d for %s", replicas, wl))

				if err := r.k8s.ScaleStatefulSet(ctx, ns, name, targetReplicas); err != nil {
					r.errLog(logCh, fmt.Sprintf("Failed to scale %s: %s", wl, err))
					counts.Errors++
					continue
				}
				r.ok(logCh, fmt.Sprintf("Scaled %s → %d", wl, targetReplicas))
			} else {
				r.plan(logCh, fmt.Sprintf("Would snapshot replicas=%d for %s", replicas, wl))
				r.plan(logCh, fmt.Sprintf("Would scale %s → %d", wl, targetReplicas))
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

	r.info(logCh, "Identifying nodes with critical workloads...")
	allPods, err := r.k8s.ListAllPods(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list pods: "+err.Error())
		counts.Errors++
		return counts, nil
	}

	// Combine global + policy skip_ns_node
	skipNsNode := splitCSV(g.SkipNsNode)
	if pg != nil {
		for ns := range splitCSV(pg.SkipNsNode) {
			skipNsNode[ns] = true
		}
	}

	criticalNodes := map[string]bool{}
	for _, pod := range allPods {
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
	}

	// Combine global + policy node labels/taints
	skipNodeLabels := g.SkipNodeLabels
	skipNodeTaints := g.SkipNodeTaints
	if pg != nil {
		if pg.SkipNodeLabels != "" {
			if skipNodeLabels != "" {
				skipNodeLabels += ","
			}
			skipNodeLabels += pg.SkipNodeLabels
		}
		if pg.SkipNodeTaints != "" {
			if skipNodeTaints != "" {
				skipNodeTaints += ","
			}
			skipNodeTaints += pg.SkipNodeTaints
		}
	}

	for _, node := range nodes {
		name := node.Name

		// Check label protection
		labelProtected := false
		for _, kv := range strings.Split(skipNodeLabels, ",") {
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
		for _, kv := range strings.Split(skipNodeTaints, ",") {
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

// RunScaleDownLegacy is the v1 backward-compat scale-down using the legacy schedule.
// It still uses annotations for state storage (v1 behaviour).
func (r *Runner) RunScaleDownLegacy(ctx context.Context, mode, namespaceFilter string, logCh chan<- LogLine) (*Counts, error) {
	counts := &Counts{}

	g, err := r.store.GetGuardrails()
	if err != nil {
		return nil, fmt.Errorf("guardrails: %w", err)
	}

	skipNS := splitCSV(g.SkipNamespaces)
	skipNsNode := splitCSV(g.SkipNsNode)

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
