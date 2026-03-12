package scaler

import (
	"fmt"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const annotationKey = "previous-replicas"

// LogLine is emitted during a run and sent to the log channel.
type LogLine struct {
	Level   string    // "info" | "ok" | "plan" | "error" | "warn"
	Message string
	Time    time.Time
}

// Counts tracks operation counters across a run.
type Counts struct {
	Scaled  int
	Drained int
	Deleted int
	Skipped int
	Errors  int
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
	}
}

func (r *Runner) info(ch chan<- LogLine, msg string)  { emit(ch, "info", msg) }
func (r *Runner) ok(ch chan<- LogLine, msg string)    { emit(ch, "ok", msg) }
func (r *Runner) plan(ch chan<- LogLine, msg string)  { emit(ch, "plan", msg) }
func (r *Runner) errLog(ch chan<- LogLine, msg string) { emit(ch, "error", msg) }

// splitCSV splits a comma-separated string into a trimmed set.
func splitCSV(s string) map[string]bool {
	m := map[string]bool{}
	for _, v := range strings.Split(s, ",") {
		v = strings.TrimSpace(v)
		if v != "" {
			m[v] = true
		}
	}
	return m
}

// isApply returns true when mode is "apply".
func isApply(mode string) bool { return mode == "apply" }

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
