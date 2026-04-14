// SPDX-License-Identifier: Apache-2.0

package observability

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const ringBufferSize = 4096

// CallRecorder stores recent API calls in a thread-safe ring buffer.
type CallRecorder struct {
	mu    sync.Mutex
	buf   [ringBufferSize]store.ApiCall
	pos   int
	count int
	seq   atomic.Uint64
}

// NewCallRecorder creates an empty call recorder.
func NewCallRecorder() *CallRecorder {
	return &CallRecorder{}
}

// Record adds a new API call to the ring buffer.
func (r *CallRecorder) Record(method, path string, statusCode int, durationMs float64) {
	info := lookupRouteInfo(method, path)
	call := store.ApiCall{
		ID:         fmt.Sprintf("call-%d", r.seq.Add(1)),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Method:     method,
		Path:       path,
		StatusCode: statusCode,
		DurationMs: durationMs,
		Component:  info.component,
		GoFunc:     info.goFunc,
		Category:   info.category,
	}

	r.mu.Lock()
	r.buf[r.pos] = call
	r.pos = (r.pos + 1) % ringBufferSize
	if r.count < ringBufferSize {
		r.count++
	}
	r.mu.Unlock()
}

// Recent returns the latest n calls, newest first.
func (r *CallRecorder) Recent(n int) []store.ApiCall {
	r.mu.Lock()
	defer r.mu.Unlock()

	if n > r.count {
		n = r.count
	}
	result := make([]store.ApiCall, n)
	for i := range n {
		idx := (r.pos - 1 - i + ringBufferSize) % ringBufferSize
		result[i] = r.buf[idx]
	}
	return result
}

type routeInfo struct {
	component string
	goFunc    string
	category  string
}

var routeComponentMap = map[string]routeInfo{
	// Auth
	"GET /api/auth/me":            {"auth", "h.me", "http"},
	"GET /api/auth/sessions":      {"auth", "h.listSessions", "http"},
	"POST /api/auth/login":        {"auth", "h.login", "http"},
	"POST /api/auth/logout":       {"auth", "h.logout", "http"},
	"PUT /api/auth/password":      {"auth", "h.changePassword", "http"},
	"PUT /api/auth/settings":      {"auth", "h.updateUserSettings", "http"},
	"GET /api/auth/oidc/config":   {"auth", "h.oidcConfig", "http"},
	"GET /api/auth/oidc/login":    {"auth", "h.oidcLogin", "http"},
	"GET /api/auth/oidc/callback": {"auth", "h.oidcCallback", "http"},
	// Cluster
	"GET /api/overview":                                         {"handlers", "h.getOverview", "http"},
	"GET /api/cluster/workloads":                                {"handlers", "h.getWorkloads", "http"},
	"GET /api/cluster/nodes":                                    {"handlers", "h.getNodes", "http"},
	"GET /api/cluster/info":                                     {"handlers", "h.getClusterInfo", "http"},
	"GET /api/cluster/nodes/{name}/pods":                        {"handlers", "h.getNodePods", "http"},
	"GET /api/cluster/pods/{namespace}/{name}":                  {"handlers", "h.getPodDetail", "http"},
	"GET /api/cluster/pods/{namespace}/{name}/logs":             {"handlers", "h.getPodLogs", "http"},
	"GET /api/cluster/workloads/{namespace}/{kind}/{name}/pods": {"handlers", "h.getWorkloadPods", "http"},
	// Guardrails
	"GET /api/guardrails": {"handlers", "h.getGuardrails", "http"},
	"PUT /api/guardrails": {"handlers", "h.updateGuardrails", "http"},
	// Policies
	"GET /api/policies":                {"handlers", "h.listPolicies", "http"},
	"GET /api/policies/{id}":           {"handlers", "h.getPolicy", "http"},
	"POST /api/policies":               {"handlers", "h.createPolicy", "http"},
	"PUT /api/policies/{id}":           {"handlers", "h.updatePolicy", "http"},
	"DELETE /api/policies/{id}":        {"handlers", "h.deletePolicy", "http"},
	"GET /api/policies/{id}/snapshots": {"handlers", "h.getPolicySnapshots", "http"},
	"POST /api/policies/{id}/sleep":    {"handlers", "h.triggerPolicySleep", "http"},
	"POST /api/policies/{id}/wake":     {"handlers", "h.triggerPolicyWake", "http"},
	"POST /api/policies/{id}/cancel":   {"handlers", "h.cancelPolicyExecution", "http"},
	// Executions
	"GET /api/policy-executions":                {"handlers", "h.listPolicyExecutions", "http"},
	"GET /api/policy-executions/{id}":           {"handlers", "h.getPolicyExecution", "http"},
	"GET /api/policy-executions/{id}/logs":      {"handlers", "h.getPolicyExecutionLogs", "http"},
	"GET /api/policy-executions/{id}/snapshots": {"handlers", "h.getPolicyExecutionSnapshots", "http"},
	// Exceptions
	"GET /api/exceptions":         {"handlers", "h.listExceptions", "http"},
	"GET /api/exceptions/{id}":    {"handlers", "h.getException", "http"},
	"POST /api/exceptions":        {"handlers", "h.createException", "http"},
	"PUT /api/exceptions/{id}":    {"handlers", "h.updateException", "http"},
	"DELETE /api/exceptions/{id}": {"handlers", "h.deleteException", "http"},
	// Audit
	"GET /api/audit-logs": {"handlers", "h.listAuditLogs", "http"},
	// Users
	"GET /api/users":         {"handlers", "h.listUsers", "http"},
	"POST /api/users":        {"handlers", "h.createUser", "http"},
	"PUT /api/users/{id}":    {"handlers", "h.updateUser", "http"},
	"DELETE /api/users/{id}": {"handlers", "h.deleteUser", "http"},
	// Admin
	"POST /api/danger/reset-db":        {"handlers", "h.resetDB", "http"},
	"POST /api/danger/emergency-scale": {"handlers", "h.emergencyScale", "http"},
	// Observability
	"GET /api/observability/history":    {"handlers", "h.getObservabilityHistory", "http"},
	"GET /api/observability/thresholds": {"handlers", "h.getObservabilityThresholds", "http"},
	"PUT /api/observability/thresholds": {"handlers", "h.updateObservabilityThreshold", "http"},
	"GET /api/observability/config":     {"handlers", "h.getObservabilityConfig", "http"},
	// Version
	"GET /api/version": {"handlers", "h.getVersion", "http"},
	// WebSocket
	"GET /ws/policy-executions/{id}/logs": {"ws-broker", "h.wsPolicyExecutionLogs", "ws"},
	// K8s API calls (recorded via recordK8sOpWith)
	"K8S list deployment":   {"k8s-client", "ListDeployments", "k8s"},
	"K8S list statefulset":  {"k8s-client", "ListStatefulSets", "k8s"},
	"K8S list node":         {"k8s-client", "ListNodes", "k8s"},
	"K8S list pod":          {"k8s-client", "ListPods", "k8s"},
	"K8S list replicaset":   {"k8s-client", "ListReplicaSets", "k8s"},
	"K8S list event":        {"k8s-client", "GetPodEvents", "k8s"},
	"K8S get deployment":    {"k8s-client", "GetDeployment", "k8s"},
	"K8S get statefulset":   {"k8s-client", "GetStatefulSet", "k8s"},
	"K8S get pod":           {"k8s-client", "GetPod", "k8s"},
	"K8S get node":          {"k8s-client", "GetNode", "k8s"},
	"K8S get podmetrics":    {"k8s-client", "GetPodMetrics", "k8s"},
	"K8S get podlogs":       {"k8s-client", "GetPodLogs", "k8s"},
	"K8S scale deployment":  {"k8s-client", "ScaleDeployment", "k8s"},
	"K8S scale statefulset": {"k8s-client", "ScaleStatefulSet", "k8s"},
	"K8S cordon node":       {"k8s-client", "CordonNode", "k8s"},
	"K8S drain node":        {"k8s-client", "DrainNode", "k8s"},
	"K8S delete node":       {"k8s-client", "DeleteNode", "k8s"},
}

// skipRecorderRoutes are routes excluded from the call feed ring buffer:
// streaming endpoints whose duration grows indefinitely.
var skipRecorderRoutes = map[string]bool{
	"/api/cluster/stream":                       true,
	"/api/observability/stream":                 true,
	"/api/cluster/pods/{namespace}/{name}/logs": true,
	"/healthz": true,
	"/metrics": true,
	"/*":       true,
	"/api/*":   true,
}

// skipMetricsRoutes are routes excluded from Prometheus HTTP histograms.
// Includes everything in skipRecorderRoutes plus long-lived connections
// that are recorded in the call feed but would skew latency metrics.
var skipMetricsRoutes = map[string]bool{
	"/api/cluster/stream":                       true,
	"/api/observability/stream":                 true,
	"/api/cluster/pods/{namespace}/{name}/logs": true,
	"/ws/policy-executions/{id}/logs":           true,
	"/api/auth/login":                           true,
	"/healthz":                                  true,
	"/metrics":                                  true,
	"/*":                                        true,
	"/api/*":                                    true,
}

// IsSkippedRecorderRoute returns true for routes excluded from the call feed.
func IsSkippedRecorderRoute(routePattern string) bool {
	return skipRecorderRoutes[routePattern]
}

// IsSkippedMetricsRoute returns true for routes excluded from Prometheus HTTP metrics.
func IsSkippedMetricsRoute(routePattern string) bool {
	return skipMetricsRoutes[routePattern]
}

var defaultRouteInfo = routeInfo{
	component: "handlers",
	goFunc:    "unknown",
	category:  "http",
}

func lookupRouteInfo(method, routePattern string) routeInfo {
	key := method + " " + routePattern
	if info, ok := routeComponentMap[key]; ok {
		return info
	}
	return defaultRouteInfo
}
