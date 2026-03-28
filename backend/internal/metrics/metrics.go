// Package metrics defines and registers all Prometheus metrics for kube-phoenix.
// Metrics are registered once via promauto and exposed at /metrics.
// Covers: HTTP requests, K8s API calls, policy executions, CRUD operations,
// scheduler health, WebSocket connections, auth, and cluster cache.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// ExecutionsTotal counts every completed policy execution by outcome.
	ExecutionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_executions_total",
		Help: "Total number of policy executions, partitioned by status, mode, and direction.",
	}, []string{"mode", "direction", "status"})

	// ExecutionDuration observes the wall-clock duration of each execution.
	ExecutionDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "kube_phoenix_execution_duration_seconds",
		Help:    "Duration of policy executions in seconds.",
		Buckets: []float64{5, 15, 30, 60, 120, 300, 600, 1800},
	}, []string{"mode", "direction", "status"})

	// WorkloadsScaledTotal counts workloads (Deployments + StatefulSets) affected.
	WorkloadsScaledTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_workloads_scaled_total",
		Help: "Total number of workloads scaled, partitioned by direction (sleep or wake).",
	}, []string{"direction"})

	// NodesDrainedTotal counts nodes drained across all sleep executions.
	NodesDrainedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_nodes_drained_total",
		Help: "Total number of nodes drained during sleep operations.",
	})

	// NodesDeletedTotal counts nodes deleted across all sleep executions.
	NodesDeletedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_nodes_deleted_total",
		Help: "Total number of nodes deleted during sleep operations.",
	})

	// ActivePolicies tracks how many policies are enabled, by mode.
	ActivePolicies = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "kube_phoenix_active_policies",
		Help: "Number of enabled policies, partitioned by mode.",
	}, []string{"mode"})

	// ─── User management metrics ─────────────────────────────────────────

	// AuthAttemptsTotal counts login attempts by status and method.
	AuthAttemptsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_auth_attempts_total",
		Help: "Total login attempts, partitioned by status (success|failure) and method (local|oidc).",
	}, []string{"status", "method"})

	// UserActionsTotal counts user-initiated mutations.
	UserActionsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_user_actions_total",
		Help: "Total user actions, partitioned by action and resource_type.",
	}, []string{"action", "resource_type"})

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

	// ─── Cluster cache metrics ───────────────────────────────────────────

	// CacheRebuildsTotal counts cluster cache snapshot rebuilds.
	CacheRebuildsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_cache_rebuilds_total",
		Help: "Total number of cluster cache snapshot rebuilds.",
	})

	// CacheRebuildDuration observes the time spent rebuilding the snapshot.
	CacheRebuildDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "kube_phoenix_cache_rebuild_duration_seconds",
		Help:    "Time spent rebuilding the cluster cache snapshot.",
		Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1},
	})

	// ─── HTTP request metrics ────────────────────────────────────────────

	// HTTPRequestsTotal counts every HTTP request by method, route pattern, and status code.
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_http_requests_total",
		Help: "Total HTTP requests, partitioned by method, path, and status_code.",
	}, []string{"method", "path", "status_code"})

	// HTTPRequestDuration observes HTTP request latency by method and route pattern.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "kube_phoenix_http_request_duration_seconds",
		Help:    "Duration of HTTP requests in seconds.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	}, []string{"method", "path"})

	// ─── Kubernetes client metrics ───────────────────────────────────────

	// K8sRequestsTotal counts Kubernetes API calls by verb, resource, and outcome.
	K8sRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_k8s_requests_total",
		Help: "Total Kubernetes API requests, partitioned by verb, resource, and status.",
	}, []string{"verb", "resource", "status"})

	// K8sRequestDuration observes Kubernetes API call latency.
	K8sRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "kube_phoenix_k8s_request_duration_seconds",
		Help:    "Duration of Kubernetes API requests in seconds.",
		Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
	}, []string{"verb", "resource"})

	// ─── CRUD operation metrics ──────────────────────────────────────────

	// PolicyOperationsTotal counts policy create/update/delete outcomes.
	PolicyOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_policy_operations_total",
		Help: "Total policy CRUD operations, partitioned by operation and status.",
	}, []string{"operation", "status"})

	// OverrideOperationsTotal counts override create/delete outcomes.
	OverrideOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_override_operations_total",
		Help: "Total override CRUD operations, partitioned by operation and status.",
	}, []string{"operation", "status"})

	// ExceptionOperationsTotal counts exception create/update/delete outcomes.
	ExceptionOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kube_phoenix_exception_operations_total",
		Help: "Total exception CRUD operations, partitioned by operation and status.",
	}, []string{"operation", "status"})

	// ─── WebSocket metrics ───────────────────────────────────────────────

	// WSConnectionsTotal counts total WebSocket connections opened.
	WSConnectionsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_ws_connections_total",
		Help: "Total WebSocket connections opened.",
	})

	// WSActiveConnections tracks currently active WebSocket connections.
	WSActiveConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "kube_phoenix_ws_active_connections",
		Help: "Number of currently active WebSocket connections.",
	})

	// ─── Scheduler metrics ───────────────────────────────────────────────

	// SchedulerEvaluationsTotal counts scheduler evaluation ticks.
	SchedulerEvaluationsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_scheduler_evaluations_total",
		Help: "Total scheduler tick evaluations.",
	})

	// SchedulerEvaluationDuration observes time spent per evaluation tick.
	SchedulerEvaluationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "kube_phoenix_scheduler_evaluation_duration_seconds",
		Help:    "Duration of each scheduler evaluation tick in seconds.",
		Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5},
	})

	// SchedulerPanicsTotal counts recovered panics in background goroutines.
	SchedulerPanicsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kube_phoenix_scheduler_panics_total",
		Help: "Total recovered panics in scheduler and background goroutines.",
	})
)
