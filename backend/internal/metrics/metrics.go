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
)
