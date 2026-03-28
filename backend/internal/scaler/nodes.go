package scaler

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
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
// workloads (pods in protected namespaces) and how many evictable (non-DaemonSet)
// pods each node has.
func classifyNodes(pods []corev1.Pod, skipNsNode map[string]bool) (criticalNodes map[string]bool, podCountPerNode map[string]int) {
	criticalNodes = map[string]bool{}
	podCountPerNode = map[string]int{}
	for _, pod := range pods {
		if skipNsNode[pod.Namespace] {
			criticalNodes[pod.Spec.NodeName] = true
		}
		isDaemon := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				isDaemon = true
				break
			}
		}
		if !isDaemon {
			podCountPerNode[pod.Spec.NodeName]++
		}
	}
	return criticalNodes, podCountPerNode
}

// drainNodes handles node draining and deletion during scale-down. Nodes are
// drained concurrently, bounded by ScalingConcurrency.
func (r *Runner) drainNodes(ctx context.Context, mode string, guardrails *store.Guardrails, logCh chan<- LogLine, counts *Counts) {
	r.info(logCh, "Fetching nodes...")
	nodes, err := r.k8s.ListNodes(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list nodes: "+err.Error())
		counts.Errors++
		return
	}

	r.info(logCh, "Identifying nodes with critical workloads...")
	allPods, err := r.k8s.ListAllPods(ctx)
	if err != nil {
		r.errLog(logCh, "Failed to list pods: "+err.Error())
		counts.Errors++
		return
	}

	skipNsNode := splitCSV(guardrails.SkipNsNode)
	criticalNodes, podCountPerNode := classifyNodes(allPods, skipNsNode)

	// Collect drainable nodes, skipping protected ones.
	var targets []drainTarget
	for _, node := range nodes {
		name := node.Name
		if isLabelProtected(node.Labels, guardrails.SkipNodeLabels) || isTaintProtected(node.Spec.Taints, guardrails.SkipNodeTaints) {
			r.info(logCh, fmt.Sprintf("Protected node %s (label/taint match)", name))
			counts.Protected++
			continue
		}
		if criticalNodes[name] {
			r.info(logCh, fmt.Sprintf("Protected node %s (running critical workload)", name))
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

	r.info(logCh, fmt.Sprintf("Draining %d nodes (concurrency=%d)...", len(targets), guardrails.ScalingConcurrency))
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
		r.plan(logCh, fmt.Sprintf("Would drain node %s (pods=%d timeout=%s)", t.name, t.podCount, t.drainTimeout))
		r.plan(logCh, fmt.Sprintf("Would delete node object %s", t.name))
		return true, true, false
	}

	r.info(logCh, fmt.Sprintf("Draining node %s (pods=%d timeout=%s)...", t.name, t.podCount, t.drainTimeout))
	if err := r.k8s.DrainNode(ctx, t.name, t.drainTimeout); err != nil {
		r.errLog(logCh, fmt.Sprintf("Drain failed for %s: %s", t.name, err))
		return false, false, true
	}
	r.ok(logCh, fmt.Sprintf("Drained node %s", t.name))

	if err := r.k8s.DeleteNode(ctx, t.name); err != nil {
		r.errLog(logCh, fmt.Sprintf("Failed to delete node %s: %s", t.name, err))
		return true, false, true
	}
	r.ok(logCh, fmt.Sprintf("Deleted node object %s", t.name))
	return true, true, false
}
