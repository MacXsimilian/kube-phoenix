// SPDX-License-Identifier: Apache-2.0

package scaler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/nodeutil"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	corev1 "k8s.io/api/core/v1"
)

const (
	drainTimeoutPerPod = 15 // seconds per pod
	drainTimeoutBase   = 60 // base seconds
)

// drainTarget holds the information needed to drain and delete a single node.
type drainTarget struct {
	name         string
	podCount     int
	drainTimeout time.Duration
}

// classifyNodes groups pods by node, identifying which nodes run critical
// workloads (pods in protected namespaces or with critical priority) and how
// many evictable pods each node has. DaemonSet pods are ignored entirely:
// they exist on every node by design, get filtered out of eviction, and would
// otherwise cause every node to be classified as critical.
func classifyNodes(pods []corev1.Pod, skipNsNode map[string]bool, protectCriticalPodNodes bool) (criticalNodes map[string]bool, podCountPerNode map[string]int) {
	criticalNodes = map[string]bool{}
	podCountPerNode = map[string]int{}
	for _, pod := range pods {
		if isDaemonOwnedPod(pod) {
			continue
		}
		podCountPerNode[pod.Spec.NodeName]++
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
			continue
		}
		if protectCriticalPodNodes && nodeutil.IsCriticalPod(pod.Spec.PriorityClassName) {
			criticalNodes[pod.Spec.NodeName] = true
		}
	}
	return criticalNodes, podCountPerNode
}

func isDaemonOwnedPod(pod corev1.Pod) bool {
	for _, ref := range pod.OwnerReferences {
		if ref.Kind == "DaemonSet" {
			return true
		}
	}
	return false
}

// drainNodes handles node draining and deletion during scale-down. Nodes are
// drained concurrently, bounded by ScalingConcurrency.
func (r *Runner) drainNodes(ctx context.Context, mode string, guardrails *store.Guardrails, logCh chan<- LogLine, counts *Counts) {
	emit(logCh, "info", "Fetching nodes...")
	nodes, err := r.k8s.ListNodes(ctx)
	if err != nil {
		emit(logCh, "error", "Failed to list nodes: "+err.Error())
		counts.Errors++
		return
	}

	emit(logCh, "info", "Identifying nodes with critical workloads...")
	allPods, err := r.k8s.ListAllPods(ctx)
	if err != nil {
		emit(logCh, "error", "Failed to list pods: "+err.Error())
		counts.Errors++
		return
	}

	skipNsNode := stringutil.SplitCSVSet(guardrails.SkipNsNode)
	criticalNodes, podCountPerNode := classifyNodes(allPods, skipNsNode, guardrails.ProtectCriticalPodNodes)

	labelMatchers := nodeutil.ParseLabels(guardrails.SkipNodeLabels)
	taintMatchers := nodeutil.ParseTaints(guardrails.SkipNodeTaints)

	// Collect drainable nodes, skipping protected ones.
	var targets []drainTarget
	for _, node := range nodes {
		name := node.Name
		if isLabelProtected(node.Labels, labelMatchers) || isTaintProtected(node.Spec.Taints, taintMatchers) {
			emit(logCh, "info", fmt.Sprintf("Protected node %s (label/taint match)", name))
			counts.Protected++
			continue
		}
		if criticalNodes[name] {
			emit(logCh, "info", fmt.Sprintf("Protected node %s (running critical workload)", name))
			counts.Protected++
			continue
		}
		podCount := podCountPerNode[name]
		drainTimeout := time.Duration(podCount*drainTimeoutPerPod+drainTimeoutBase) * time.Second
		targets = append(targets, drainTarget{name, podCount, drainTimeout})
	}

	if len(targets) == 0 {
		return
	}

	emit(logCh, "info", fmt.Sprintf("Draining %d nodes (concurrency=%d)...", len(targets), guardrails.ScalingConcurrency))
	r.drainConcurrent(ctx, mode, targets, guardrails.ScalingConcurrency, logCh, counts)
}

// drainConcurrent drains and deletes nodes in parallel, bounded by concurrency.
// Uses its own mutex to protect Counts since drainAndDeleteNode updates
// Drained/Deleted/Errors which are not covered by runConcurrent's return-value pattern.
func (r *Runner) drainConcurrent(ctx context.Context, mode string, targets []drainTarget, concurrency int, logCh chan<- LogLine, counts *Counts) {
	if concurrency <= 0 {
		concurrency = defaultScalingConcurrency
	}
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, t := range targets {
		t := t
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			drained, deleted, errored := r.drainAndDeleteNode(ctx, mode, t, logCh)
			mu.Lock()
			if drained {
				counts.Drained++
			}
			if deleted {
				counts.Deleted++
			}
			if errored {
				counts.Errors++
			}
			mu.Unlock()
		}()
	}
	wg.Wait()
}

// drainAndDeleteNode drains and deletes a single node. Returns result flags
// for thread-safe aggregation by the caller.
func (r *Runner) drainAndDeleteNode(ctx context.Context, mode string, t drainTarget, logCh chan<- LogLine) (drained, deleted, errored bool) {
	if !isApply(mode) {
		emit(logCh, "plan", fmt.Sprintf("Would drain node %s (pods=%d timeout=%s)", t.name, t.podCount, t.drainTimeout))
		emit(logCh, "plan", fmt.Sprintf("Would delete node object %s", t.name))
		return true, true, false
	}

	emit(logCh, "info", fmt.Sprintf("Draining node %s (pods=%d timeout=%s)...", t.name, t.podCount, t.drainTimeout))
	if err := r.k8s.DrainNode(ctx, t.name, t.drainTimeout); err != nil {
		emit(logCh, "error", fmt.Sprintf("Drain failed for %s: %s", t.name, err))
		return false, false, true
	}
	emit(logCh, "ok", fmt.Sprintf("Drained node %s", t.name))

	if err := r.k8s.DeleteNode(ctx, t.name); err != nil {
		emit(logCh, "error", fmt.Sprintf("Failed to delete node %s: %s", t.name, err))
		return true, false, true
	}
	emit(logCh, "ok", fmt.Sprintf("Deleted node object %s", t.name))
	return true, true, false
}
