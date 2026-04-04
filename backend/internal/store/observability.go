package store

import (
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
	HTTPRequestRate     float64 `json:"httpRequestRate"`     // req/s since last tick
	HTTPLatencyP50Ms    float64 `json:"httpLatencyP50Ms"`    // milliseconds
	HTTPLatencyP95Ms    float64 `json:"httpLatencyP95Ms"`    // milliseconds
	HTTPLatencyP99Ms    float64 `json:"httpLatencyP99Ms"`    // milliseconds
	HTTPErrorRate       float64 `json:"httpErrorRate"`       // 5xx/s since last tick

	// Kubernetes API
	K8sGetRate    float64 `json:"k8sGetRate"`    // calls/min
	K8sPatchRate  float64 `json:"k8sPatchRate"`  // calls/min
	K8sDeleteRate float64 `json:"k8sDeleteRate"` // calls/min

	// Policy executions
	PolicySuccessCount int `json:"policySuccessCount"` // in the tick window
	PolicyFailedCount  int `json:"policyFailedCount"`
	PolicySkippedCount int `json:"policySkippedCount"`

	// WebSocket
	WSActiveConnections int `json:"wsActiveConnections"`

	// Cache
	CacheHitRate float64 `json:"cacheHitRate"` // percentage 0-100

	// Scheduler
	SchedulerEvalRate     float64 `json:"schedulerEvalRate"`     // evals/min
	SchedulerEvalDurationMs float64 `json:"schedulerEvalDurationMs"` // avg ms per eval

	// Pod scale operations
	WorkloadsScaledCount int     `json:"workloadsScaledCount"` // in the tick window
	ScaleOperationDurationMs float64 `json:"scaleOperationDurationMs"`

	// Error aggregates
	SchedulerPanics int     `json:"schedulerPanics"` // in the tick window
	AuditDrops      int     `json:"auditDrops"`
	RateLimitHits   int     `json:"rateLimitHits"`
	TotalErrorRate  float64 `json:"totalErrorRate"` // combined error/s
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
	q := s.db.Where("timestamp BETWEEN ? AND ?", from, to).Order("timestamp ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// PruneMetricSnapshots deletes snapshots older than the given cutoff.
func (s *Store) PruneMetricSnapshots(before time.Time) (int64, error) {
	tx := s.db.Where("timestamp < ?", before).Delete(&MetricSnapshot{})
	return tx.RowsAffected, tx.Error
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
func (s *Store) UpsertObservabilityThreshold(t *ObservabilityThreshold) error {
	return s.db.Where("panel_key = ?", t.PanelKey).
		Assign(ObservabilityThreshold{WarnVal: t.WarnVal, CritVal: t.CritVal}).
		FirstOrCreate(t).Error
}

// SeedDefaultThresholds inserts default thresholds if none exist.
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
	for i := range defaults {
		var count int64
		s.db.Model(&ObservabilityThreshold{}).Where("panel_key = ?", defaults[i].PanelKey).Count(&count)
		if count == 0 {
			if err := s.db.Create(&defaults[i]).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// downsampleSnapshots reduces a slice of snapshots by averaging every n rows.
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
	n := float64(len(bucket))
	avg := MetricSnapshot{
		Timestamp: bucket[len(bucket)/2].Timestamp,
	}
	for _, s := range bucket {
		avg.HTTPRequestRate += s.HTTPRequestRate
		avg.HTTPLatencyP50Ms += s.HTTPLatencyP50Ms
		avg.HTTPLatencyP95Ms += s.HTTPLatencyP95Ms
		avg.HTTPLatencyP99Ms += s.HTTPLatencyP99Ms
		avg.HTTPErrorRate += s.HTTPErrorRate
		avg.K8sGetRate += s.K8sGetRate
		avg.K8sPatchRate += s.K8sPatchRate
		avg.K8sDeleteRate += s.K8sDeleteRate
		avg.PolicySuccessCount += s.PolicySuccessCount
		avg.PolicyFailedCount += s.PolicyFailedCount
		avg.PolicySkippedCount += s.PolicySkippedCount
		avg.WSActiveConnections += s.WSActiveConnections
		avg.CacheHitRate += s.CacheHitRate
		avg.SchedulerEvalRate += s.SchedulerEvalRate
		avg.SchedulerEvalDurationMs += s.SchedulerEvalDurationMs
		avg.WorkloadsScaledCount += s.WorkloadsScaledCount
		avg.ScaleOperationDurationMs += s.ScaleOperationDurationMs
		avg.SchedulerPanics += s.SchedulerPanics
		avg.AuditDrops += s.AuditDrops
		avg.RateLimitHits += s.RateLimitHits
		avg.TotalErrorRate += s.TotalErrorRate
	}
	avg.HTTPRequestRate /= n
	avg.HTTPLatencyP50Ms /= n
	avg.HTTPLatencyP95Ms /= n
	avg.HTTPLatencyP99Ms /= n
	avg.HTTPErrorRate /= n
	avg.K8sGetRate /= n
	avg.K8sPatchRate /= n
	avg.K8sDeleteRate /= n
	avg.PolicySuccessCount = int(float64(avg.PolicySuccessCount) / n)
	avg.PolicyFailedCount = int(float64(avg.PolicyFailedCount) / n)
	avg.PolicySkippedCount = int(float64(avg.PolicySkippedCount) / n)
	avg.WSActiveConnections = int(float64(avg.WSActiveConnections) / n)
	avg.CacheHitRate /= n
	avg.SchedulerEvalRate /= n
	avg.SchedulerEvalDurationMs /= n
	avg.WorkloadsScaledCount = int(float64(avg.WorkloadsScaledCount) / n)
	avg.ScaleOperationDurationMs /= n
	avg.SchedulerPanics = int(float64(avg.SchedulerPanics) / n)
	avg.AuditDrops = int(float64(avg.AuditDrops) / n)
	avg.RateLimitHits = int(float64(avg.RateLimitHits) / n)
	avg.TotalErrorRate /= n
	return avg
}

// maxPointsForRange returns the target number of data points for a time range.
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

// ObservabilityStreamPayload is the SSE event payload sent to the frontend.
type ObservabilityStreamPayload struct {
	Snapshot   MetricSnapshot          `json:"snapshot"`
	Components []RiverComponentMetrics `json:"components"`
	Links      []RiverLinkMetrics      `json:"links"`
	Thresholds []ObservabilityThreshold `json:"thresholds"`
}

// migrateObservability is called from runMigrations to add observability tables.
func migrateObservability(db *gorm.DB) error {
	return db.AutoMigrate(&MetricSnapshot{}, &ObservabilityThreshold{})
}
