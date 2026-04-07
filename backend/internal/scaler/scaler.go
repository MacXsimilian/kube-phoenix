// SPDX-License-Identifier: Apache-2.0

// Package scaler performs Kubernetes scaling operations for sleep and wake,
// including scaling deployments and draining nodes.
package scaler

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/nodeutil"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

// LogLine is emitted during a run and sent to the log channel.
type LogLine struct {
	Level   string // "info" | "ok" | "plan" | "error" | "warn"
	Message string
	Time    time.Time
}

// Counts tracks operation counters across a run.
type Counts struct {
	Saved     int
	Scaled    int
	Drained   int
	Deleted   int
	Skipped   int
	Protected int
	Errors    int
	Requests  int       // K8s API calls made during this run
	StartedAt time.Time // when the scaling operation began
	mu        sync.Mutex
}

// AddRequests atomically increments the K8s API call counter.
func (c *Counts) AddRequests(n int) {
	c.mu.Lock()
	c.Requests += n
	c.mu.Unlock()
}

// Duration returns the wall-clock time elapsed since the run started.
func (c *Counts) Duration() time.Duration {
	return time.Since(c.StartedAt)
}

// RequestsPerSecond returns the average K8s API call rate for this run.
func (c *Counts) RequestsPerSecond() float64 {
	d := c.Duration().Seconds()
	if d <= 0 {
		return 0
	}
	return float64(c.Requests) / d
}

// Runner holds dependencies shared by scale-down and scale-up.
type Runner struct {
	k8s   *k8s.Client
	store *store.Store
}

func New(k8sClient *k8s.Client, st *store.Store) *Runner {
	return &Runner{k8s: k8sClient, store: st}
}

// emit sends a log line to the channel (non-blocking if full).
func emit(ch chan<- LogLine, level, msg string) {
	select {
	case ch <- LogLine{Level: level, Message: msg, Time: time.Now()}:
	default:
		slog.Warn("scaler: log line dropped — channel full", "level", level)
	}
}

func isApply(mode string) bool { return mode == store.PolicyModeApply }

// namespaceAllowed returns true if the namespace should be processed.
// If filter is empty, all namespaces are allowed (subject to guardrail skip list).
// If filter is set, only listed namespaces are allowed.
// filterSnapshotsByNamespace returns only snapshots whose namespace matches
// the comma-separated filter. Used by scoped exception wakes to avoid
// restoring workloads outside the exception's target.
func filterSnapshotsByNamespace(snaps []store.WorkloadSnapshot, filter string) []store.WorkloadSnapshot {
	out := make([]store.WorkloadSnapshot, 0, len(snaps))
	for _, s := range snaps {
		if namespaceAllowed(s.Namespace, filter) {
			out = append(out, s)
		}
	}
	return out
}

func namespaceAllowed(ns, filter string) bool {
	if filter == "" {
		return true
	}
	return stringutil.SplitCSVSet(filter)[ns]
}

// formatWorkload returns "Deployment default/nginx" style.
func formatWorkload(kind, ns, name string) string {
	return fmt.Sprintf("%s %s/%s", kind, ns, name)
}

// ── Workload abstraction for scale-down / scale-up ───────────────────────────

// workloadEntry is a uniform representation of a Deployment or StatefulSet
// used by the shared scale-down and scale-up helpers.
type workloadEntry struct {
	Kind      string
	Namespace string
	Name      string
	Replicas  int32
	Scale     func(ctx context.Context, ns, name string, replicas int32) error
}

// deploymentToEntry converts a Deployment into a workloadEntry, populating the
// scale function pointer from the k8s client.
func (r *Runner) deploymentToEntry(d appsv1.Deployment) workloadEntry {
	replicas := int32(0)
	if d.Spec.Replicas != nil {
		replicas = *d.Spec.Replicas
	}
	return workloadEntry{
		Kind: "Deployment", Namespace: d.Namespace, Name: d.Name,
		Replicas: replicas, Scale: r.k8s.ScaleDeployment,
	}
}

// statefulSetToEntry converts a StatefulSet into a workloadEntry.
func (r *Runner) statefulSetToEntry(ss appsv1.StatefulSet) workloadEntry {
	replicas := int32(0)
	if ss.Spec.Replicas != nil {
		replicas = *ss.Spec.Replicas
	}
	return workloadEntry{
		Kind: "StatefulSet", Namespace: ss.Namespace, Name: ss.Name,
		Replicas: replicas, Scale: r.k8s.ScaleStatefulSet,
	}
}

// collectFilteredEntries converts Deployments and StatefulSets to workloadEntry
// slices, filtering by skipNS and namespaceFilter. Filtered-out items always
// increment counts.Skipped.
func (r *Runner) collectFilteredEntries(
	deployments []appsv1.Deployment,
	statefulsets []appsv1.StatefulSet,
	skipNS map[string]bool,
	namespaceFilter string,
	counts *Counts,
) []workloadEntry {
	entries := make([]workloadEntry, 0, len(deployments)+len(statefulsets))
	for _, d := range deployments {
		if skipNS[d.Namespace] || !namespaceAllowed(d.Namespace, namespaceFilter) {
			counts.Skipped++
			continue
		}
		entries = append(entries, r.deploymentToEntry(d))
	}
	for _, ss := range statefulsets {
		if skipNS[ss.Namespace] || !namespaceAllowed(ss.Namespace, namespaceFilter) {
			counts.Skipped++
			continue
		}
		entries = append(entries, r.statefulSetToEntry(ss))
	}
	return entries
}

// ── Node protection helpers ──────────────────────────────────────────────────

func isLabelProtected(labels map[string]string, skipNodeLabels string) bool {
	return nodeutil.MatchLabel(labels, skipNodeLabels) != ""
}

func isTaintProtected(taints []corev1.Taint, skipNodeTaints string) bool {
	return nodeutil.MatchTaint(taints, skipNodeTaints) != ""
}

// ── Priority namespace helpers ────────────────────────────────────────────────

// parsePriorityList parses a comma-separated priority string into a rank map
// (namespace → position index). Returns nil, false when the input yields no
// valid namespaces.
func parsePriorityList(csv string) (map[string]int, bool) {
	if csv == "" {
		return nil, false
	}
	rank := make(map[string]int)
	idx := 0
	for _, s := range strings.Split(csv, ",") {
		ns := strings.TrimSpace(s)
		if ns == "" {
			continue
		}
		if _, exists := rank[ns]; !exists {
			rank[ns] = idx
			idx++
		}
	}
	if len(rank) == 0 {
		return nil, false
	}
	return rank, true
}

// sortByPriority reorders items so that those whose namespace appears in rank
// come first (preserving priority list order). Non-priority items keep their
// original relative order.
func sortByPriority[T any](items []T, rank map[string]int, ns func(T) string) []T {
	priority := make([]T, 0)
	rest := make([]T, 0, len(items))
	buckets := make(map[int][]T)
	for _, item := range items {
		if r, found := rank[ns(item)]; found {
			buckets[r] = append(buckets[r], item)
		} else {
			rest = append(rest, item)
		}
	}
	for i := 0; i < len(rank); i++ {
		priority = append(priority, buckets[i]...)
	}
	return append(priority, rest...)
}

// sortByPriorityNamespaces reorders workload entries by priority namespace.
func sortByPriorityNamespaces(entries []workloadEntry, priorityCSV string) []workloadEntry {
	rank, ok := parsePriorityList(priorityCSV)
	if !ok {
		return entries
	}
	return sortByPriority(entries, rank, func(e workloadEntry) string { return e.Namespace })
}

// sortSnapshotsByPriority reorders WorkloadSnapshot slices by priority namespace.
func sortSnapshotsByPriority(snaps []store.WorkloadSnapshot, priorityCSV string) []store.WorkloadSnapshot {
	rank, ok := parsePriorityList(priorityCSV)
	if !ok {
		return snaps
	}
	return sortByPriority(snaps, rank, func(s store.WorkloadSnapshot) string { return s.Namespace })
}
