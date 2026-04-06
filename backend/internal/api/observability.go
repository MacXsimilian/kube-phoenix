// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// registerObservabilityRoutes mounts the observability dashboard endpoints.
func (h *Handler) registerObservabilityRoutes(r chi.Router) {
	r.Get("/observability/stream", h.streamObservability)
	r.Get("/observability/history", h.getObservabilityHistory)
	r.Get("/observability/thresholds", h.getObservabilityThresholds)
	r.Put("/observability/thresholds", h.updateObservabilityThreshold)
	r.Get("/observability/config", h.getObservabilityConfig)
}

// RuntimeLimit is a single key-value limit for a component.
type RuntimeLimit struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// RuntimeConfig returns all component limits read from actual runtime values.
type RuntimeConfig struct {
	Components map[string][]RuntimeLimit `json:"components"`
}

func (h *Handler) getObservabilityConfig(w http.ResponseWriter, r *http.Request) {
	schedulerInterval := "30s"
	if g, err := h.store.GetGuardrails(); err == nil {
		schedulerInterval = g.SchedulerEvalInterval
		if schedulerInterval == "" {
			schedulerInterval = "30s"
		}
	}

	k8sQPS := envOrDefault("K8S_QPS", "100")
	k8sBurst := envOrDefault("K8S_BURST", "200")

	cfg := RuntimeConfig{
		Components: map[string][]RuntimeLimit{
			"chi":        {{Label: "Max body", Value: "1 MB"}},
			"auth":       {{Label: "Rate limit (IP)", Value: fmtRateLimit(rateLimitPerIP, rateLimitWindow)}, {Label: "Rate limit (user)", Value: fmtRateLimit(rateLimitPerUser, rateLimitWindow)}},
			"k8s-client": {{Label: "QPS", Value: k8sQPS}, {Label: "Burst", Value: k8sBurst}},
			"store":      {{Label: "Pool size", Value: strconv.Itoa(store.DBMaxOpenConns)}, {Label: "Idle conns", Value: strconv.Itoa(store.DBMaxIdleConns)}, {Label: "Conn lifetime", Value: store.DBConnMaxLifetime.String()}},
			"cache":      {{Label: "Resync", Value: "5m"}, {Label: "Max subscribers", Value: "100"}},
			"broker":     {{Label: "Channel buffer", Value: "256"}},
			"audit":      {{Label: "Write buffer", Value: "4096"}},
			"scheduler":  {{Label: "Tick interval", Value: schedulerInterval}},
			"postgres":   {{Label: "Tables", Value: "11"}},
		},
	}
	jsonOK(w, cfg)
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func fmtRateLimit(limit int, window time.Duration) string {
	return strconv.Itoa(limit) + " req / " + window.String()
}

// streamObservability sends metric snapshots + river data as Server-Sent Events.
func (h *Handler) streamObservability(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	rc := http.NewResponseController(w)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	keepalive := time.NewTicker(sseKeepaliveInterval)
	defer keepalive.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := rc.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
				return
			}
			if !h.writeSSEObservability(w, flusher) {
				return
			}
		case <-keepalive.C:
			if err := rc.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
				return
			}
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (h *Handler) writeSSEObservability(w http.ResponseWriter, flusher http.Flusher) bool {
	payload := h.obsCollector.LatestPayload()
	if payload == nil {
		return true
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return false
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		return false
	}
	flusher.Flush()
	return true
}

// getObservabilityHistory returns metric snapshots for a time range.
// Query params: from (RFC3339), to (RFC3339), range (duration string like "1h", "3d")
func (h *Handler) getObservabilityHistory(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	var from, to time.Time

	if rangeStr := r.URL.Query().Get("range"); rangeStr != "" {
		d, err := parseDurationExtended(rangeStr)
		if err != nil {
			jsonError(w, "invalid range: "+err.Error(), http.StatusBadRequest)
			return
		}
		from = now.Add(-d)
		to = now
	} else {
		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")
		var err error
		if from, err = time.Parse(time.RFC3339, fromStr); err != nil {
			jsonError(w, "invalid from: "+err.Error(), http.StatusBadRequest)
			return
		}
		if to, err = time.Parse(time.RFC3339, toStr); err != nil {
			jsonError(w, "invalid to: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	maxPoints := store.MaxPointsForRange(to.Sub(from))

	snapshots, err := h.store.QueryMetricSnapshotsDownsampled(from, to, maxPoints)
	if err != nil {
		jsonError(w, "query failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, snapshots)
}

// getObservabilityThresholds returns all configured thresholds.
func (h *Handler) getObservabilityThresholds(w http.ResponseWriter, r *http.Request) {
	thresholds, err := h.store.ListObservabilityThresholds()
	if err != nil {
		jsonError(w, "failed to load thresholds", http.StatusInternalServerError)
		return
	}
	jsonOK(w, thresholds)
}

// updateObservabilityThreshold creates or updates a threshold.
func (h *Handler) updateObservabilityThreshold(w http.ResponseWriter, r *http.Request) {
	var t store.ObservabilityThreshold
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		jsonError(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if t.PanelKey == "" {
		jsonError(w, "panelKey is required", http.StatusBadRequest)
		return
	}
	if t.WarnVal < 0 || t.CritVal < 0 {
		jsonError(w, "threshold values must not be negative", http.StatusBadRequest)
		return
	}
	if err := h.store.UpsertObservabilityThreshold(&t); err != nil {
		jsonError(w, "save failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, t)
}

// parseDurationExtended extends time.ParseDuration with "d" (day) support.
func parseDurationExtended(s string) (time.Duration, error) {
	var d time.Duration
	if len(s) > 1 && s[len(s)-1] == 'd' {
		var days int
		if _, err := fmt.Sscanf(s, "%dd", &days); err != nil {
			return 0, fmt.Errorf("invalid day duration: %s", s)
		}
		d = time.Duration(days) * 24 * time.Hour
	} else {
		var err error
		d, err = time.ParseDuration(s)
		if err != nil {
			return 0, err
		}
	}
	if d <= 0 {
		return 0, fmt.Errorf("duration must be positive: %s", s)
	}
	return d, nil
}
