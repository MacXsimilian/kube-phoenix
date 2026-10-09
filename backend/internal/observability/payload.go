// SPDX-License-Identifier: Apache-2.0

package observability

import "github.com/macxsimilian/kube-phoenix/backend/internal/store"

// buildPayload constructs the SSE event payload from current metrics.
func buildPayload(snapshot *store.MetricSnapshot, thresholds []store.ObservabilityThreshold, recentCalls []store.ApiCall) store.ObservabilityStreamPayload {
	thresholdMap := make(map[string]store.ObservabilityThreshold)
	for _, threshold := range thresholds {
		thresholdMap[threshold.PanelKey] = threshold
	}

	k8sRPS := (snapshot.K8sGetRate + snapshot.K8sPatchRate + snapshot.K8sDeleteRate) / 60

	// Traffic between components is estimated from the collected metrics.
	components := []store.RiverComponentMetrics{
		{
			Component: "router",
			RPSIn:     snapshot.HTTPRequestRate,
			RPSOut:    snapshot.HTTPRequestRate,
			LatencyMs: snapshot.HTTPLatencyP50Ms,
			ErrorRate: snapshot.HTTPErrorRate,
			Status:    thresholdStatus(snapshot.HTTPRequestRate, thresholdMap["http_rate"]),
		},
		{
			Component: "auth",
			RPSIn:     snapshot.HTTPRequestRate,
			RPSOut:    snapshot.HTTPRequestRate * 0.98,
			LatencyMs: 2,
			ErrorRate: float64(snapshot.RateLimitHits),
			Status:    "ok",
		},
		{
			Component: "handlers",
			RPSIn:     snapshot.HTTPRequestRate * 0.95,
			RPSOut:    snapshot.HTTPRequestRate * 0.90,
			LatencyMs: snapshot.HTTPLatencyP50Ms,
			ErrorRate: snapshot.HTTPErrorRate,
			Status:    thresholdStatus(snapshot.HTTPLatencyP99Ms, thresholdMap["latency_p99"]),
		},
		{
			Component: "scheduler",
			RPSIn:     snapshot.SchedulerEvalRate / 60,
			RPSOut:    snapshot.SchedulerEvalRate / 60,
			LatencyMs: snapshot.SchedulerEvalDurationMs,
			ErrorRate: float64(snapshot.SchedulerPanics),
			Status:    thresholdStatus(snapshot.SchedulerEvalDurationMs, thresholdMap["scheduler_health"]),
		},
		{
			Component: "scaler",
			RPSIn:     float64(snapshot.WorkloadsScaledCount),
			RPSOut:    snapshot.K8sGetRate/60 + snapshot.K8sPatchRate/60,
			LatencyMs: snapshot.ScaleOperationDurationMs,
			ErrorRate: 0,
			Status:    "ok",
		},
		{
			Component: "k8s-client",
			RPSIn:     k8sRPS,
			RPSOut:    k8sRPS,
			LatencyMs: snapshot.K8sLatencyP50Ms,
			ErrorRate: snapshot.K8sErrorRate / 60,
			Status:    thresholdStatus(k8sRPS, thresholdMap["k8s_api"]),
		},
		{
			Component: "store",
			RPSIn:     snapshot.HTTPRequestRate * 0.6,
			RPSOut:    snapshot.HTTPRequestRate * 0.6,
			LatencyMs: 5,
			ErrorRate: float64(snapshot.AuditDrops),
			Status:    "ok",
		},
		{
			Component: "ws-broker",
			RPSIn:     float64(snapshot.WSActiveConnections),
			RPSOut:    float64(snapshot.WSActiveConnections),
			LatencyMs: 1,
			ErrorRate: 0,
			Status:    thresholdStatus(float64(snapshot.WSActiveConnections), thresholdMap["ws_connections"]),
		},
	}

	links := []store.RiverLinkMetrics{
		{Source: "router", Target: "auth", RPS: snapshot.HTTPRequestRate, LatencyMs: 2, Category: "http"},
		{Source: "auth", Target: "handlers", RPS: snapshot.HTTPRequestRate * 0.98, LatencyMs: 1, Category: "http"},
		{Source: "handlers", Target: "scheduler", RPS: snapshot.SchedulerEvalRate / 60, LatencyMs: 1, Category: "internal"},
		{Source: "handlers", Target: "store", RPS: snapshot.HTTPRequestRate * 0.6, LatencyMs: 5, Category: "store"},
		{Source: "handlers", Target: "ws-broker", RPS: float64(snapshot.WSActiveConnections) * 0.1, LatencyMs: 1, Category: "ws"},
		{Source: "scheduler", Target: "scaler", RPS: float64(snapshot.WorkloadsScaledCount) * 0.5, LatencyMs: snapshot.SchedulerEvalDurationMs, Category: "internal"},
		{Source: "scaler", Target: "k8s-client", RPS: (snapshot.K8sPatchRate + snapshot.K8sDeleteRate) / 60, LatencyMs: 50, Category: "k8s"},
		{Source: "k8s-client", Target: "store", RPS: snapshot.K8sGetRate / 60 * 0.3, LatencyMs: 5, Category: "store"},
		{Source: "scheduler", Target: "ws-broker", RPS: snapshot.SchedulerEvalRate / 60 * 0.5, LatencyMs: 1, Category: "ws"},
		{Source: "ws-broker", Target: "handlers", RPS: float64(snapshot.WSActiveConnections) * 0.05, LatencyMs: 1, Category: "ws"},
	}

	return store.ObservabilityStreamPayload{
		Snapshot:    *snapshot,
		Components:  components,
		Links:       links,
		Thresholds:  thresholds,
		RecentCalls: recentCalls,
	}
}

func thresholdStatus(value float64, threshold store.ObservabilityThreshold) string {
	if threshold.PanelKey == "" {
		return "ok"
	}
	// For cache_hit, lower is worse (inverted)
	if threshold.PanelKey == "cache_hit" {
		if value < threshold.CritVal {
			return "crit"
		}
		if value < threshold.WarnVal {
			return "warn"
		}
		return "ok"
	}
	if value >= threshold.CritVal {
		return "crit"
	}
	if value >= threshold.WarnVal {
		return "warn"
	}
	return "ok"
}
