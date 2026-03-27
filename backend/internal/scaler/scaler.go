package scaler

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/macxsimilian/kube-phoenix/backend/internal/stringutil"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

const annotationKey = "previous-replicas"

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
func emit(logCh chan<- LogLine, level, msg string) {
	select {
	case logCh <- LogLine{Level: level, Message: msg, Time: time.Now()}:
	default:
		slog.Warn("scaler: log line dropped — channel full", "level", level)
	}
}

func (r *Runner) info(logCh chan<- LogLine, msg string)   { emit(logCh, "info", msg) }
func (r *Runner) ok(logCh chan<- LogLine, msg string)     { emit(logCh, "ok", msg) }
func (r *Runner) plan(logCh chan<- LogLine, msg string)   { emit(logCh, "plan", msg) }
func (r *Runner) errLog(logCh chan<- LogLine, msg string) { emit(logCh, "error", msg) }

// mergeCSV merges two comma-separated strings into a single trimmed set.
func mergeCSV(a, b string) map[string]bool {
	m := stringutil.SplitCSVSet(a)
	for k, v := range stringutil.SplitCSVSet(b) {
		m[k] = v
	}
	return m
}

// splitCSV splits a comma-separated string into a trimmed set.
func splitCSV(s string) map[string]bool {
	return stringutil.SplitCSVSet(s)
}

// isApply returns true when mode is "apply".
func isApply(mode string) bool { return mode == store.PolicyModeApply }

// namespaceAllowed returns true if the namespace should be processed.
// If filter is empty, all namespaces are allowed (subject to guardrail skip list).
// If filter is set, only listed namespaces are allowed.
func namespaceAllowed(ns, filter string) bool {
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

// formatWorkload returns "Deployment default/nginx" style.
func formatWorkload(kind, ns, name string) string {
	return fmt.Sprintf("%s %s/%s", kind, ns, name)
}

// ── Workload abstraction for scale-down / scale-up ───────────────────────────

// workloadEntry is a uniform representation of a Deployment or StatefulSet
// used by the shared scale-down and scale-up helpers.
// Annotate and Scale are set for scale-down. RemoveAnnotation is set for scale-up.
type workloadEntry struct {
	Kind        string
	Namespace   string
	Name        string
	Replicas    int32
	Annotations map[string]string
	// Annotate saves the current replica count as a k8s annotation (scale-down).
	Annotate func(ctx context.Context, ns, name, key, value string) error
	// Scale sets the workload replica count (scale-down and scale-up).
	Scale func(ctx context.Context, ns, name string, replicas int32) error
	// RemoveAnnotation clears the saved replica annotation after a successful restore (scale-up).
	RemoveAnnotation func(ctx context.Context, ns, name, key string) error
}

// deploymentToEntry converts a Deployment into a workloadEntry, populating the
// function pointers from the k8s client. Fields that are unused by the caller
// (e.g. Annotate for scale-up, RemoveAnnotation for scale-down) are left nil.
func (r *Runner) deploymentToEntry(d appsv1.Deployment) workloadEntry {
	replicas := int32(0)
	if d.Spec.Replicas != nil {
		replicas = *d.Spec.Replicas
	}
	return workloadEntry{
		Kind: "Deployment", Namespace: d.Namespace, Name: d.Name,
		Replicas: replicas, Annotations: d.Annotations,
		Annotate: r.k8s.AnnotateDeployment, Scale: r.k8s.ScaleDeployment,
		RemoveAnnotation: r.k8s.RemoveDeploymentAnnotation,
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
		Replicas: replicas, Annotations: ss.Annotations,
		Annotate: r.k8s.AnnotateStatefulSet, Scale: r.k8s.ScaleStatefulSet,
		RemoveAnnotation: r.k8s.RemoveStatefulSetAnnotation,
	}
}

// filterOptions controls namespace filtering behaviour in collectFilteredEntries.
type filterOptions struct {
	// skipNamespaces is the merged set of system and user-configured namespaces to skip.
	skipNamespaces map[string]bool
	// namespaceFilter is an optional comma-separated allow-list; empty means all namespaces.
	namespaceFilter string
	// countSkipped controls whether filtered-out workloads increment counts.Skipped.
	// Set true for scale-down; false for scale-up.
	countSkipped bool
}

// collectFilteredEntries converts Deployments and StatefulSets to workloadEntry
// slices, applying the namespace filters described by opts.
func (r *Runner) collectFilteredEntries(
	deployments []appsv1.Deployment,
	statefulsets []appsv1.StatefulSet,
	opts filterOptions,
	counts *Counts,
) []workloadEntry {
	entries := make([]workloadEntry, 0, len(deployments)+len(statefulsets))
	for _, d := range deployments {
		if opts.skipNamespaces[d.Namespace] || !namespaceAllowed(d.Namespace, opts.namespaceFilter) {
			if opts.countSkipped {
				counts.Skipped++
			}
			continue
		}
		entries = append(entries, r.deploymentToEntry(d))
	}
	for _, ss := range statefulsets {
		if opts.skipNamespaces[ss.Namespace] || !namespaceAllowed(ss.Namespace, opts.namespaceFilter) {
			if opts.countSkipped {
				counts.Skipped++
			}
			continue
		}
		entries = append(entries, r.statefulSetToEntry(ss))
	}
	return entries
}

// scaleDownWorkloads annotates current replicas then scales each workload to 0.
// counts is mutated in place as a side effect: Saved, Scaled, Skipped, and Errors are incremented.
func (r *Runner) scaleDownWorkloads(ctx context.Context, mode string, entries []workloadEntry, logCh chan<- LogLine, counts *Counts) {
	for _, e := range entries {
		wl := formatWorkload(e.Kind, e.Namespace, e.Name)

		if !r.saveAnnotation(ctx, mode, e, wl, logCh, counts) {
			continue
		}
		if e.Replicas == 0 {
			r.info(logCh, fmt.Sprintf("Already scaled down: %s", wl))
			counts.Skipped++
			continue
		}
		r.applyScale(ctx, scaleOptions{
			mode:       mode,
			target:     0,
			successMsg: fmt.Sprintf("Scaled %s → 0", wl),
			planMsg:    fmt.Sprintf("Would scale %s → 0", wl),
		}, e, wl, logCh, counts)
	}
}

// restoreWorkloads restores each workload from the previous-replicas annotation.
func (r *Runner) restoreWorkloads(ctx context.Context, mode string, entries []workloadEntry, logCh chan<- LogLine, counts *Counts) {
	for _, e := range entries {
		savedStr, ok := e.Annotations[annotationKey]
		if !ok {
			counts.Skipped++
			continue
		}
		saved, err := strconv.ParseInt(savedStr, 10, 32)
		if err != nil {
			r.errLog(logCh, fmt.Sprintf("Invalid annotation on %s %s/%s: %s", e.Kind, e.Namespace, e.Name, savedStr))
			counts.Errors++
			continue
		}
		wl := formatWorkload(e.Kind, e.Namespace, e.Name)

		if isApply(mode) {
			if err := e.Scale(ctx, e.Namespace, e.Name, int32(saved)); err != nil {
				r.errLog(logCh, fmt.Sprintf("Failed to scale up %s: %s", wl, err))
				counts.Errors++
				continue
			}
			r.ok(logCh, fmt.Sprintf("Restored %s → %d", wl, saved))
			if err := e.RemoveAnnotation(ctx, e.Namespace, e.Name, annotationKey); err != nil {
				r.errLog(logCh, fmt.Sprintf("Failed to remove annotation from %s: %s", wl, err))
			}
		} else {
			r.plan(logCh, fmt.Sprintf("Would restore %s → %d", wl, saved))
		}
		counts.Scaled++
	}
}

// saveAnnotation saves the current replica count annotation. Returns false if the
// workload should be skipped (annotation error in apply mode).
func (r *Runner) saveAnnotation(ctx context.Context, mode string, e workloadEntry, wl string, logCh chan<- LogLine, counts *Counts) bool {
	if _, alreadySaved := e.Annotations[annotationKey]; alreadySaved {
		r.info(logCh, fmt.Sprintf("Annotation already saved for %s (skipping overwrite)", wl))
		return true
	}
	if isApply(mode) {
		if err := e.Annotate(ctx, e.Namespace, e.Name, annotationKey, fmt.Sprintf("%d", e.Replicas)); err != nil {
			r.errLog(logCh, fmt.Sprintf("Failed to annotate %s: %s", wl, err))
			counts.Errors++
			return false
		}
		r.info(logCh, fmt.Sprintf("Saved replicas=%d for %s", e.Replicas, wl))
	} else {
		r.plan(logCh, fmt.Sprintf("Would save replicas=%d for %s", e.Replicas, wl))
	}
	counts.Saved++
	return true
}

// scaleOptions parameterises a single applyScale call.
type scaleOptions struct {
	// mode is the policy execution mode ("apply" or "plan").
	mode string
	// target is the desired replica count.
	target int32
	// successMsg is logged on a successful apply.
	successMsg string
	// planMsg is logged when running in plan (dry-run) mode.
	planMsg string
}

// applyScale scales or plans a workload to the target replica count.
func (r *Runner) applyScale(ctx context.Context, opts scaleOptions, e workloadEntry, wl string, logCh chan<- LogLine, counts *Counts) {
	if isApply(opts.mode) {
		if err := e.Scale(ctx, e.Namespace, e.Name, opts.target); err != nil {
			r.errLog(logCh, fmt.Sprintf("Failed to scale %s: %s", wl, err))
			counts.Errors++
			return
		}
		r.ok(logCh, opts.successMsg)
	} else {
		r.plan(logCh, opts.planMsg)
	}
	counts.Scaled++
}

// ── Node protection helpers ──────────────────────────────────────────────────

func isLabelProtected(labels map[string]string, skipNodeLabels string) bool {
	for _, kv := range strings.Split(skipNodeLabels, ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) != 2 {
			continue
		}
		if v, ok := labels[parts[0]]; ok && v == parts[1] {
			return true
		}
	}
	return false
}

func isTaintProtected(taints []corev1.Taint, skipNodeTaints string) bool {
	for _, kv := range strings.Split(skipNodeTaints, ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		for _, taint := range taints {
			if fmt.Sprintf("%s=%s:%s", taint.Key, taint.Value, taint.Effect) == kv {
				return true
			}
		}
	}
	return false
}
