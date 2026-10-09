// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// MetricSnapshot stores a point-in-time capture of all Prometheus metrics
// for the observability dashboard. The collector service writes one row per
// tick; the frontend queries historical ranges from this table.
type MetricSnapshot struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Timestamp time.Time `gorm:"index:idx_ms_ts;not null" json:"timestamp"`

	// HTTP
	HTTPRequestRate  float64 `json:"httpRequestRate"`  // req/s since last tick
	HTTPLatencyP50Ms float64 `json:"httpLatencyP50Ms"` // milliseconds
	HTTPLatencyP95Ms float64 `json:"httpLatencyP95Ms"` // milliseconds
	HTTPLatencyP99Ms float64 `json:"httpLatencyP99Ms"` // milliseconds
	HTTPErrorRate    float64 `json:"httpErrorRate"`    // 5xx/s since last tick

	// Kubernetes API
	K8sGetRate      float64 `json:"k8sGetRate"`      // calls/min
	K8sPatchRate    float64 `json:"k8sPatchRate"`    // calls/min
	K8sDeleteRate   float64 `json:"k8sDeleteRate"`   // calls/min
	K8sLatencyP50Ms float64 `json:"k8sLatencyP50Ms"` // milliseconds
	K8sLatencyP99Ms float64 `json:"k8sLatencyP99Ms"` // milliseconds

	// Policy executions
	PolicySuccessCount     int `json:"policySuccessCount"` // in the tick window
	PolicyFailedCount      int `json:"policyFailedCount"`
	PolicyInterruptedCount int `json:"policyInterruptedCount"`

	// WebSocket
	WSActiveConnections int `json:"wsActiveConnections"`

	// Cache
	CacheHitRate float64 `json:"cacheHitRate"` // percentage 0-100

	// Scheduler
	SchedulerEvalRate       float64 `json:"schedulerEvalRate"`       // evals/min
	SchedulerEvalDurationMs float64 `json:"schedulerEvalDurationMs"` // avg ms per eval

	// Pod scale operations
	WorkloadsScaledCount     int     `json:"workloadsScaledCount"` // in the tick window
	ScaleOperationDurationMs float64 `json:"scaleOperationDurationMs"`

	// Error aggregates
	SchedulerPanics int     `json:"schedulerPanics"` // in the tick window
	AuditDrops      int     `json:"auditDrops"`
	RateLimitHits   int     `json:"rateLimitHits"`
	TotalErrorRate  float64 `json:"totalErrorRate"` // combined error/s

	// Database pool
	DBPoolOpen  int `json:"dbPoolOpen"`
	DBPoolInUse int `json:"dbPoolInUse"`
	DBPoolIdle  int `json:"dbPoolIdle"`

	// Auth & session
	ActiveSessions int `json:"activeSessions"`

	// Active policies
	ActivePolicies int `json:"activePolicies"`

	// K8s error rate
	K8sErrorRate float64 `json:"k8sErrorRate"` // failed K8s API calls/min
}

// ObservabilityThreshold stores user-configurable warn/crit thresholds per metric panel.
type ObservabilityThreshold struct {
	ID       uint    `gorm:"primaryKey" json:"id"`
	PanelKey string  `gorm:"uniqueIndex;size:50;not null" json:"panelKey"` // e.g. "http_rate", "latency_p99"
	WarnVal  float64 `json:"warnVal"`
	CritVal  float64 `json:"critVal"`
}

// SaveMetricSnapshot inserts a single metric snapshot row.
func (s *Store) SaveMetricSnapshot(snap *MetricSnapshot) error {
	return s.db.Create(snap).Error
}

// QueryMetricSnapshots returns snapshots within [from, to], ordered by timestamp.
// The caller is responsible for downsampling if the range is large.
func (s *Store) QueryMetricSnapshots(from, to time.Time, limit int) ([]MetricSnapshot, error) {
	var rows []MetricSnapshot
	query := s.db.Where("timestamp BETWEEN ? AND ?", from, to).Order("timestamp ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// QueryMetricSnapshotsDownsampled returns at most maxPoints snapshots within
// [from, to], using SQL-level row selection to avoid loading all rows.
func (s *Store) QueryMetricSnapshotsDownsampled(from, to time.Time, maxPoints int) ([]MetricSnapshot, error) {
	var total int64
	if err := s.db.Model(&MetricSnapshot{}).Where("timestamp BETWEEN ? AND ?", from, to).Count(&total).Error; err != nil {
		return nil, err
	}
	if total <= int64(maxPoints) {
		return s.QueryMetricSnapshots(from, to, 0)
	}
	step := int(total) / maxPoints
	var rows []MetricSnapshot
	err := s.db.Raw(`SELECT * FROM (
		SELECT *, ROW_NUMBER() OVER (ORDER BY timestamp) as rn
		FROM metric_snapshots WHERE timestamp BETWEEN ? AND ?
	) sub WHERE sub.rn % ? = 0 ORDER BY timestamp`, from, to, step).Scan(&rows).Error
	return rows, err
}

// PruneMetricSnapshots deletes snapshots older than the given cutoff.
func (s *Store) PruneMetricSnapshots(before time.Time) (int64, error) {
	result := s.db.Where("timestamp < ?", before).Delete(&MetricSnapshot{})
	return result.RowsAffected, result.Error
}

// ListObservabilityThresholds returns all configured thresholds.
func (s *Store) ListObservabilityThresholds() ([]ObservabilityThreshold, error) {
	var rows []ObservabilityThreshold
	if err := s.db.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// UpsertObservabilityThreshold creates or updates a threshold for the given panel.
func (s *Store) UpsertObservabilityThreshold(threshold *ObservabilityThreshold) error {
	return s.db.Where("panel_key = ?", threshold.PanelKey).
		Assign(ObservabilityThreshold{WarnVal: threshold.WarnVal, CritVal: threshold.CritVal}).
		FirstOrCreate(threshold).Error
}

// SeedDefaultThresholds inserts default thresholds if none exist.
// Runs inside a transaction so either all defaults are seeded or none are.
func (s *Store) SeedDefaultThresholds() error {
	defaults := []ObservabilityThreshold{
		{PanelKey: "http_rate", WarnVal: 150, CritVal: 200},
		{PanelKey: "latency_p99", WarnVal: 500, CritVal: 1000},
		{PanelKey: "k8s_api", WarnVal: 100, CritVal: 120},
		{PanelKey: "ws_connections", WarnVal: 50, CritVal: 80},
		{PanelKey: "cache_hit", WarnVal: 90, CritVal: 70},
		{PanelKey: "error_rate", WarnVal: 5, CritVal: 15},
		{PanelKey: "scheduler_health", WarnVal: 200, CritVal: 500},
		{PanelKey: "policy_executions", WarnVal: 5, CritVal: 10},
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		for i := range defaults {
			var count int64
			if err := tx.Model(&ObservabilityThreshold{}).Where("panel_key = ?", defaults[i].PanelKey).Count(&count).Error; err != nil {
				return fmt.Errorf("check threshold %s: %w", defaults[i].PanelKey, err)
			}
			if count == 0 {
				if err := tx.Create(&defaults[i]).Error; err != nil {
					return fmt.Errorf("seed threshold %s: %w", defaults[i].PanelKey, err)
				}
			}
		}
		return nil
	})
}

// DownsampleSnapshots reduces a slice of snapshots by averaging every n rows.
// Used when the frontend requests longer time ranges.
func DownsampleSnapshots(rows []MetricSnapshot, targetCount int) []MetricSnapshot {
	if len(rows) <= targetCount || targetCount <= 0 {
		return rows
	}
	bucketSize := len(rows) / targetCount
	if bucketSize < 2 {
		return rows
	}
	result := make([]MetricSnapshot, 0, targetCount)
	for i := 0; i < len(rows); i += bucketSize {
		end := i + bucketSize
		if end > len(rows) {
			end = len(rows)
		}
		bucket := rows[i:end]
		avg := averageBucket(bucket)
		result = append(result, avg)
	}
	return result
}

func averageBucket(bucket []MetricSnapshot) MetricSnapshot {
	sampleCount := float64(len(bucket))
	result := MetricSnapshot{
		Timestamp: bucket[len(bucket)/2].Timestamp,
	}
	for _, snapshot := range bucket {
		result.HTTPRequestRate += snapshot.HTTPRequestRate
		result.HTTPLatencyP50Ms += snapshot.HTTPLatencyP50Ms
		result.HTTPLatencyP95Ms += snapshot.HTTPLatencyP95Ms
		result.HTTPLatencyP99Ms += snapshot.HTTPLatencyP99Ms
		result.HTTPErrorRate += snapshot.HTTPErrorRate
		result.K8sGetRate += snapshot.K8sGetRate
		result.K8sPatchRate += snapshot.K8sPatchRate
		result.K8sDeleteRate += snapshot.K8sDeleteRate
		result.CacheHitRate += snapshot.CacheHitRate
		result.SchedulerEvalRate += snapshot.SchedulerEvalRate
		result.SchedulerEvalDurationMs += snapshot.SchedulerEvalDurationMs
		result.ScaleOperationDurationMs += snapshot.ScaleOperationDurationMs
		result.TotalErrorRate += snapshot.TotalErrorRate
		result.PolicySuccessCount += snapshot.PolicySuccessCount
		result.PolicyFailedCount += snapshot.PolicyFailedCount
		result.PolicyInterruptedCount += snapshot.PolicyInterruptedCount
		result.WorkloadsScaledCount += snapshot.WorkloadsScaledCount
		result.WSActiveConnections += snapshot.WSActiveConnections
		result.SchedulerPanics += snapshot.SchedulerPanics
		result.AuditDrops += snapshot.AuditDrops
		result.RateLimitHits += snapshot.RateLimitHits
		result.ActiveSessions += snapshot.ActiveSessions
		result.ActivePolicies += snapshot.ActivePolicies
		result.K8sErrorRate += snapshot.K8sErrorRate
	}
	averageRateFields(&result, sampleCount)
	return result
}

// averageRateFields averages rates and gauges; event counts remain summed.
func averageRateFields(snapshot *MetricSnapshot, sampleCount float64) {
	snapshot.HTTPRequestRate /= sampleCount
	snapshot.HTTPLatencyP50Ms /= sampleCount
	snapshot.HTTPLatencyP95Ms /= sampleCount
	snapshot.HTTPLatencyP99Ms /= sampleCount
	snapshot.HTTPErrorRate /= sampleCount
	snapshot.K8sGetRate /= sampleCount
	snapshot.K8sPatchRate /= sampleCount
	snapshot.K8sDeleteRate /= sampleCount
	snapshot.CacheHitRate /= sampleCount
	snapshot.SchedulerEvalRate /= sampleCount
	snapshot.SchedulerEvalDurationMs /= sampleCount
	snapshot.ScaleOperationDurationMs /= sampleCount
	snapshot.TotalErrorRate /= sampleCount
	snapshot.WSActiveConnections = int(float64(snapshot.WSActiveConnections) / sampleCount)
	snapshot.ActiveSessions = int(float64(snapshot.ActiveSessions) / sampleCount)
	snapshot.ActivePolicies = int(float64(snapshot.ActivePolicies) / sampleCount)
	snapshot.K8sErrorRate /= sampleCount
}

// MaxPointsForRange returns the target number of data points for a time range.
func MaxPointsForRange(d time.Duration) int {
	switch {
	case d <= time.Minute:
		return 60 // 1s resolution
	case d <= 5*time.Minute:
		return 300 // 1s resolution
	case d <= 15*time.Minute:
		return 300 // 3s resolution
	case d <= time.Hour:
		return 240 // 15s resolution
	case d <= 6*time.Hour:
		return 360 // 1m resolution
	case d <= 24*time.Hour:
		return 1440 // 1m resolution
	default:
		return 864 // 5m resolution for 3d
	}
}

// RiverComponentMetrics holds real-time per-component metrics for the API Rivers view.
type RiverComponentMetrics struct {
	Component string  `json:"component"`
	RPSIn     float64 `json:"rpsIn"`
	RPSOut    float64 `json:"rpsOut"`
	LatencyMs float64 `json:"latencyMs"`
	ErrorRate float64 `json:"errorRate"`
	Status    string  `json:"status"` // "ok" | "warn" | "crit"
}

// RiverLinkMetrics holds real-time per-link metrics for the API Rivers view.
type RiverLinkMetrics struct {
	Source    string  `json:"source"`
	Target    string  `json:"target"`
	RPS       float64 `json:"rps"`
	LatencyMs float64 `json:"latencyMs"`
	ErrorRate float64 `json:"errorRate"`
	Category  string  `json:"category"` // "http" | "k8s" | "store" | "internal" | "ws"
}

// ApiCall represents a single recorded API call for the observability dashboard.
type ApiCall struct {
	ID         string  `json:"id"`
	Timestamp  string  `json:"timestamp"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	StatusCode int     `json:"statusCode"`
	DurationMs float64 `json:"durationMs"`
	Component  string  `json:"component"`
	GoFunc     string  `json:"goFunc"`
	Category   string  `json:"category"`
}

// ObservabilityStreamPayload is the SSE event payload sent to the frontend.
type ObservabilityStreamPayload struct {
	Snapshot    MetricSnapshot           `json:"snapshot"`
	Components  []RiverComponentMetrics  `json:"components"`
	Links       []RiverLinkMetrics       `json:"links"`
	Thresholds  []ObservabilityThreshold `json:"thresholds"`
	RecentCalls []ApiCall                `json:"recentCalls"`
}
