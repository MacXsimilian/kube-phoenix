// SPDX-License-Identifier: Apache-2.0

// Package observability implements the metric collector that periodically
// reads the local Prometheus registry, computes counter rates and histogram
// quantiles, and stores MetricSnapshot rows for the observability dashboard.
package observability

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

const (
	collectInterval = 2 * time.Second
	pruneInterval   = 1 * time.Hour
	retentionDays   = 3
)

// Collector scrapes the local Prometheus registry and writes MetricSnapshots.
type Collector struct {
	store          *store.Store
	registry       *prometheus.Registry
	previousValues map[string]float64
	previousTime   time.Time
	mu             sync.RWMutex
	latestPayload  *store.ObservabilityStreamPayload
	callRecorder   *CallRecorder
}

// NewCollector creates a collector that reads from the default Prometheus registry.
func NewCollector(st *store.Store) (*Collector, error) {
	reg, ok := prometheus.DefaultRegisterer.(*prometheus.Registry)
	if !ok {
		return nil, fmt.Errorf("default prometheus registerer is not a *prometheus.Registry")
	}
	return &Collector{
		store:          st,
		registry:       reg,
		previousValues: make(map[string]float64),
		callRecorder:   NewCallRecorder(),
	}, nil
}

// Start begins the collection loop. Blocks until ctx is cancelled.
func (c *Collector) Start(ctx context.Context) {
	slog.Info("observability: collector started", "interval", collectInterval)
	ticker := time.NewTicker(collectInterval)
	defer ticker.Stop()

	pruneTicker := time.NewTicker(pruneInterval)
	defer pruneTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("observability: collector stopped")
			return
		case <-ticker.C:
			if err := c.collect(); err != nil {
				slog.Warn("observability: collection tick failed", "err", err)
			}
		case <-pruneTicker.C:
			cutoff := time.Now().Add(-retentionDays * 24 * time.Hour)
			pruned, err := c.store.PruneMetricSnapshots(cutoff)
			if err != nil {
				slog.Warn("observability: prune failed", "err", err)
			} else if pruned > 0 {
				slog.Info("observability: pruned old snapshots", "count", pruned)
			}
		}
	}
}

func (c *Collector) collect() error {
	c.store.UpdatePoolMetrics()

	now := time.Now()
	metricFamilies, err := c.registry.Gather()
	if err != nil {
		return fmt.Errorf("gather metrics: %w", err)
	}

	current := make(map[string]float64)
	families := make(map[string]*dto.MetricFamily)
	for _, family := range metricFamilies {
		families[family.GetName()] = family
		flattenMetricFamily(family, current)
	}

	elapsed := now.Sub(c.previousTime).Seconds()
	if elapsed <= 0 || len(c.previousValues) == 0 {
		c.previousValues = current
		c.previousTime = now
		return nil
	}

	snapshot := c.buildMetricSnapshot(now, current, families, elapsed)

	c.previousValues = current
	c.previousTime = now

	if err := c.store.SaveMetricSnapshot(snapshot); err != nil {
		return fmt.Errorf("save metric snapshot: %w", err)
	}

	thresholds, err := c.store.ListObservabilityThresholds()
	if err != nil {
		slog.Warn("observability: failed to load thresholds", "err", err)
	}
	recentCalls := c.callRecorder.Recent(50)
	payload := buildPayload(snapshot, thresholds, recentCalls)
	c.mu.Lock()
	c.latestPayload = &payload
	c.mu.Unlock()

	return nil
}

// LatestPayload returns the most recent stream payload, or nil if none yet.
func (c *Collector) LatestPayload() *store.ObservabilityStreamPayload {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.latestPayload
}

// CallRecorder returns the recorder used to track API calls.
func (c *Collector) CallRecorder() *CallRecorder {
	return c.callRecorder
}
