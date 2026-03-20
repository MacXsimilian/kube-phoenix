// Package metrics defines and registers all Prometheus metrics for kube-phoenix.
// Metrics are registered once via promauto and exposed at /metrics.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// ExecutionsTotal counts every completed schedule execution by outcome.
	ExecutionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_executions_total",
		Help: "Total number of schedule executions, partitioned by status, mode, and schedule type.",
	}, []string{"status", "mode", "schedule_type"})

	// ExecutionDuration observes the wall-clock duration of each execution.
	ExecutionDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "kube_phoenix_execution_duration_seconds",
		Help:    "Duration of schedule executions in seconds.",
		Buckets: []float64{5, 15, 30, 60, 120, 300, 600, 1800},
	}, []string{"mode", "schedule_type", "status"})

	// WorkloadsScaledTotal counts workloads (Deployments + StatefulSets) affected.
	WorkloadsScaledTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_workloads_scaled_total",
		Help: "Total number of workloads scaled, partitioned by direction (down or up).",
	}, []string{"direction"})

	// NodesDrainedTotal counts nodes drained across all scale-down executions.
	NodesDrainedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_nodes_drained_total",
		Help: "Total number of nodes drained during scale-down operations.",
	})

	// NodesDeletedTotal counts nodes deleted across all scale-down executions.
	NodesDeletedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_nodes_deleted_total",
		Help: "Total number of nodes deleted during scale-down operations.",
	})

	// ActiveSchedules tracks how many schedules are enabled, by type and mode.
	// Updated every time the scheduler reloads its cron entries.
	ActiveSchedules = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "kube_phoenix_active_schedules",
		Help: "Number of enabled schedules, partitioned by schedule_type and mode.",
	}, []string{"schedule_type", "mode"})

	// ─── User management metrics ─────────────────────────────────────────

	// AuthAttemptsTotal counts login attempts by status and method.
	AuthAttemptsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_auth_attempts_total",
		Help: "Total login attempts, partitioned by status (success|failure) and method (local|oidc).",
	}, []string{"status", "method"})

	// UserActionsTotal counts user-initiated mutations.
	UserActionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_user_actions_total",
		Help: "Total user actions, partitioned by action, user, and resource_type.",
	}, []string{"action", "user", "resource_type"})

	// ActiveSessions is a gauge of currently valid sessions.
	ActiveSessions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "kube_phoenix_active_sessions",
		Help: "Number of active (non-expired) sessions.",
	})

	// RateLimitHitsTotal counts rate-limit rejections.
	RateLimitHitsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_rate_limit_hits_total",
		Help: "Total rate-limit rejections, partitioned by type (per_ip|per_username).",
	}, []string{"type"})

	// AuditDropsTotal counts audit entries dropped due to a full buffer.
	AuditDropsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_audit_drops_total",
		Help: "Total audit log entries dropped because the async write buffer was full.",
	})
)
