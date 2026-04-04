package observability

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const ringBufferSize = 100

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
	"GET /api/policies":                  {"handlers", "h.listPolicies", "http"},
	"GET /api/policies/{id}":             {"handlers", "h.getPolicy", "http"},
	"GET /api/overview":                  {"handlers", "h.getOverview", "http"},
	"GET /api/cluster/workloads":         {"handlers", "h.getWorkloads", "http"},
	"GET /api/cluster/nodes":             {"handlers", "h.getNodes", "http"},
	"GET /api/cluster/info":              {"handlers", "h.getClusterInfo", "http"},
	"GET /api/cluster/nodes/{name}/pods": {"handlers", "h.getNodePods", "http"},
	"GET /api/audit-logs":                {"handlers", "h.listAuditLogs", "http"},
	"GET /api/policy-executions":         {"handlers", "h.listPolicyExecutions", "http"},
	"GET /api/policy-executions/{id}":    {"handlers", "h.getPolicyExecution", "http"},
	"GET /api/exceptions":                {"handlers", "h.listExceptions", "http"},
	"GET /api/exceptions/{id}":           {"handlers", "h.getException", "http"},
	"GET /api/guardrails":                {"handlers", "h.getGuardrails", "http"},
	"GET /api/auth/me":                   {"auth", "h.me", "http"},
	"POST /api/auth/login":               {"auth", "h.login", "http"},
	"POST /api/auth/logout":              {"auth", "h.logout", "http"},
	"POST /api/policies/{id}/sleep":      {"handlers", "h.triggerPolicySleep", "http"},
	"POST /api/policies/{id}/wake":       {"handlers", "h.triggerPolicyWake", "http"},
	"PUT /api/guardrails":                {"handlers", "h.updateGuardrails", "http"},
	"GET /api/cluster/stream":            {"handlers", "h.streamCluster", "http"},
	"GET /api/observability/stream":      {"handlers", "h.streamObservability", "http"},
	"GET /api/observability/history":     {"handlers", "h.getObservabilityHistory", "http"},
	"GET /api/observability/thresholds":  {"handlers", "h.getObservabilityThresholds", "http"},
	"PUT /api/observability/thresholds":  {"handlers", "h.updateObservabilityThreshold", "http"},
	"GET /api/observability/config":      {"handlers", "h.getObservabilityConfig", "http"},
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
