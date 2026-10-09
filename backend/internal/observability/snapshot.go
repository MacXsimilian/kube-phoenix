// SPDX-License-Identifier: Apache-2.0

package observability

import (
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	dto "github.com/prometheus/client_model/go"
)

// buildMetricSnapshot converts registry values into dashboard units. Counter
// rates use the previous collection; histogram quantiles use cumulative buckets.
func (c *Collector) buildMetricSnapshot(now time.Time, current map[string]float64, families map[string]*dto.MetricFamily, elapsed float64) *store.MetricSnapshot {
	snapshot := &store.MetricSnapshot{
		Timestamp: now,
	}

	snapshot.HTTPRequestRate = c.counterRate("kube_phoenix_http_requests_total", current, elapsed)
	snapshot.HTTPErrorRate = c.counterRateFiltered("kube_phoenix_http_requests_total", current, elapsed, "status_code", "5")
	snapshot.K8sGetRate = (c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "list") +
		c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "get")) * 60
	snapshot.K8sPatchRate = (c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "scale") +
		c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "cordon")) * 60
	snapshot.K8sDeleteRate = (c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "delete") +
		c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "verb", "drain")) * 60
	snapshot.SchedulerEvalRate = c.counterRate("kube_phoenix_scheduler_evaluations_total", current, elapsed) * 60
	snapshot.TotalErrorRate = snapshot.HTTPErrorRate + c.counterRate("kube_phoenix_scheduler_panics_total", current, elapsed)

	snapshot.HTTPLatencyP50Ms = histogramQuantile(families["kube_phoenix_http_request_duration_seconds"], 0.50) * 1000
	snapshot.HTTPLatencyP95Ms = histogramQuantile(families["kube_phoenix_http_request_duration_seconds"], 0.95) * 1000
	snapshot.HTTPLatencyP99Ms = histogramQuantile(families["kube_phoenix_http_request_duration_seconds"], 0.99) * 1000
	snapshot.K8sLatencyP50Ms = histogramQuantile(families["kube_phoenix_k8s_request_duration_seconds"], 0.50) * 1000
	snapshot.K8sLatencyP99Ms = histogramQuantile(families["kube_phoenix_k8s_request_duration_seconds"], 0.99) * 1000
	snapshot.SchedulerEvalDurationMs = histogramQuantile(families["kube_phoenix_scheduler_evaluation_duration_seconds"], 0.50) * 1000

	snapshot.WSActiveConnections = int(gaugeValue(families["kube_phoenix_ws_active_connections"]))

	hits := counterValue(families["kube_phoenix_cache_hits_total"])
	misses := counterValue(families["kube_phoenix_cache_misses_total"])
	if hits+misses > 0 {
		snapshot.CacheHitRate = (hits / (hits + misses)) * 100
	} else {
		snapshot.CacheHitRate = 100
	}

	snapshot.PolicySuccessCount = int(c.counterRateFiltered("kube_phoenix_executions_total", current, elapsed, "status", "success") * elapsed)
	snapshot.PolicyFailedCount = int(c.counterRateFiltered("kube_phoenix_executions_total", current, elapsed, "status", "failed") * elapsed)
	snapshot.PolicyInterruptedCount = int(c.counterRateFiltered("kube_phoenix_executions_total", current, elapsed, "status", "interrupted") * elapsed)

	snapshot.WorkloadsScaledCount = int(c.counterRate("kube_phoenix_workloads_scaled_total", current, elapsed) * elapsed)
	snapshot.ScaleOperationDurationMs = histogramQuantile(families["kube_phoenix_execution_duration_seconds"], 0.50) * 1000

	snapshot.SchedulerPanics = int(c.counterRate("kube_phoenix_scheduler_panics_total", current, elapsed) * elapsed)
	snapshot.AuditDrops = int(c.counterRate("kube_phoenix_audit_drops_total", current, elapsed) * elapsed)
	snapshot.RateLimitHits = int(c.counterRate("kube_phoenix_rate_limit_hits_total", current, elapsed) * elapsed)

	snapshot.DBPoolOpen = int(gaugeValue(families["kube_phoenix_db_pool_open_connections"]))
	snapshot.DBPoolInUse = int(gaugeValue(families["kube_phoenix_db_pool_in_use"]))
	snapshot.DBPoolIdle = int(gaugeValue(families["kube_phoenix_db_pool_idle"]))

	snapshot.ActiveSessions = int(gaugeValue(families["kube_phoenix_active_sessions"]))
	snapshot.ActivePolicies = int(gaugeValue(families["kube_phoenix_active_policies"]))
	snapshot.K8sErrorRate = c.counterRateFiltered("kube_phoenix_k8s_requests_total", current, elapsed, "status", "error") * 60

	return snapshot
}
