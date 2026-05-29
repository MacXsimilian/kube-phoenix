// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
)

// overviewMemo caches the marshaled overview payload between cache rebuilds so
// concurrent SSE subscribers and plain GETs reuse a single buildOverview pass.
// The payload is invalidated when the underlying cluster cache advances its
// snapshot timestamp.
type overviewMemo struct {
	mu             sync.Mutex
	payload        []byte
	snapshotMarker time.Time
}

type NextRunInfo struct {
	Name    string `json:"name"`
	NextRun string `json:"nextRun"` // RFC3339
}

type NsSleepCount struct {
	Namespace string `json:"namespace"`
	Count     int    `json:"count"`
}

type OverviewResponse struct {
	ClusterStatus string         `json:"clusterStatus"` // "awake" | "sleeping" | "partial"
	RunningCount  int            `json:"runningCount"`
	SleepingCount int            `json:"sleepingCount"`
	NodeCount     int            `json:"nodeCount"`
	SleepingByNs  []NsSleepCount `json:"sleepingByNs"` // top namespaces with sleeping workloads
	NextRun       *NextRunInfo   `json:"nextRun"`
	CacheAgeMs    int64          `json:"cacheAgeMs"`
}

func (h *Handler) getOverview(w http.ResponseWriter, r *http.Request) {
	payload, err := h.overviewBytes()
	if err != nil {
		jsonInternalError(w, err, "overview encode failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

// overviewBytes returns the marshaled overview payload, rebuilding it only when
// the cluster cache snapshot has advanced since the last build. Policy
// transition data refreshes at the same cadence — staleness is bounded by the
// cache rebuild interval.
func (h *Handler) overviewBytes() ([]byte, error) {
	marker := h.snapshotMarker()

	h.overviewCache.mu.Lock()
	defer h.overviewCache.mu.Unlock()

	if h.overviewCache.payload != nil && h.overviewCache.snapshotMarker.Equal(marker) {
		return h.overviewCache.payload, nil
	}

	payload, err := json.Marshal(h.buildOverview())
	if err != nil {
		return nil, err
	}
	h.overviewCache.payload = payload
	h.overviewCache.snapshotMarker = marker
	return payload, nil
}

func (h *Handler) snapshotMarker() time.Time {
	if h.cache == nil {
		return time.Time{}
	}
	return h.cache.Snapshot().FetchedAt
}

// invalidateOverviewMemo forces the next overviewBytes call to rebuild even
// when the cluster cache snapshot has not advanced. Used after policy CRUD so
// the NextRun field reflects changes before the next informer-driven rebuild.
func (h *Handler) invalidateOverviewMemo() {
	h.overviewCache.mu.Lock()
	h.overviewCache.payload = nil
	h.overviewCache.mu.Unlock()
}

// streamCluster streams OverviewResponse updates as Server-Sent Events.
// Each cache rebuild pushes a new event to all connected clients.
const sseKeepaliveInterval = 30 * time.Second

func (h *Handler) streamCluster(w http.ResponseWriter, r *http.Request) {
	if h.cache == nil {
		jsonError(w, "cluster cache unavailable", http.StatusServiceUnavailable)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ch := h.cache.Subscribe()
	if ch == nil {
		jsonError(w, "too many streaming connections", http.StatusServiceUnavailable)
		return
	}
	defer h.cache.Unsubscribe(ch)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx response buffering
	w.WriteHeader(http.StatusOK)

	// Send current state immediately so the client gets data before the first tick
	if !h.writeSSEOverview(w, flusher) {
		return
	}

	keepalive := time.NewTicker(sseKeepaliveInterval)
	defer keepalive.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ch:
			if !h.writeSSEOverview(w, flusher) {
				return
			}
		case <-keepalive.C:
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (h *Handler) writeSSEOverview(w http.ResponseWriter, flusher http.Flusher) bool {
	payload, err := h.overviewBytes()
	if err != nil {
		return false
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
		return false
	}
	flusher.Flush()
	return true
}

func (h *Handler) buildOverview() OverviewResponse {
	resp := OverviewResponse{
		ClusterStatus: "awake",
		SleepingByNs:  []NsSleepCount{},
	}

	if h.cache != nil {
		if snap := h.cache.Snapshot(); snap.Ready() {
			resp.CacheAgeMs = snap.AgeMs()
			populateWorkloadCounts(&resp, snap, h.savedReplicasMap())
		}
	}

	h.populateNextRun(&resp)
	return resp
}

// replicaInfo holds the fields needed to classify a workload's sleep status.
type replicaInfo struct {
	Kind      string
	Namespace string
	Name      string
	Replicas  *int32
}

// countWorkloads tallies running vs sleeping workloads and tracks sleeping-by-namespace.
func countWorkloads(items []replicaInfo, saved map[string]int32) (running, sleeping int, nsSleep map[string]int) {
	nsSleep = map[string]int{}
	for _, item := range items {
		current := int32(0)
		if item.Replicas != nil {
			current = *item.Replicas
		}
		savedPtr := lookupSaved(saved, item.Kind, item.Namespace, item.Name)
		if workloadStatus(current, savedPtr) == "sleeping" {
			sleeping++
			nsSleep[item.Namespace]++
		} else {
			running++
		}
	}
	return
}

func populateWorkloadCounts(resp *OverviewResponse, snap k8s.CachedSnapshot, saved map[string]int32) {
	items := make([]replicaInfo, 0, len(snap.Deployments)+len(snap.StatefulSets))
	for _, d := range snap.Deployments {
		items = append(items, replicaInfo{Kind: "Deployment", Namespace: d.Namespace, Name: d.Name, Replicas: d.Spec.Replicas})
	}
	for _, ss := range snap.StatefulSets {
		items = append(items, replicaInfo{Kind: "StatefulSet", Namespace: ss.Namespace, Name: ss.Name, Replicas: ss.Spec.Replicas})
	}

	running, sleeping, nsSleep := countWorkloads(items, saved)

	resp.RunningCount = running
	resp.SleepingCount = sleeping
	resp.NodeCount = len(snap.Nodes)

	switch {
	case resp.SleepingCount > 0 && resp.RunningCount == 0:
		resp.ClusterStatus = "sleeping"
	case resp.SleepingCount > 0:
		resp.ClusterStatus = "partial"
	}

	resp.SleepingByNs = topSleepingNamespaces(nsSleep, 4)
}

func topSleepingNamespaces(nsSleep map[string]int, limit int) []NsSleepCount {
	type nsEntry struct {
		name  string
		count int
	}
	var nsList []nsEntry
	for name, count := range nsSleep {
		nsList = append(nsList, nsEntry{name, count})
	}
	sort.Slice(nsList, func(i, j int) bool { return nsList[i].count > nsList[j].count })
	if len(nsList) > limit {
		nsList = nsList[:limit]
	}
	result := make([]NsSleepCount, len(nsList))
	for i, ns := range nsList {
		result[i] = NsSleepCount{Namespace: ns.name, Count: ns.count}
	}
	return result
}

func (h *Handler) populateNextRun(resp *OverviewResponse) {
	policies, err := h.store.ListPolicies()
	if err != nil {
		return
	}
	var enabledIDs []uint
	nameByID := map[uint]string{}
	for _, p := range policies {
		if p.Enabled {
			enabledIDs = append(enabledIDs, p.ID)
			nameByID[p.ID] = p.Name
		}
	}
	if len(enabledIDs) == 0 {
		return
	}
	transitions := h.policyScheduler.NextTransitions(enabledIDs)
	var earliestTime *time.Time
	for id, t := range transitions {
		if t != nil && (earliestTime == nil || t.Before(*earliestTime)) {
			earliestTime = t
			resp.NextRun = &NextRunInfo{
				Name:    nameByID[id],
				NextRun: t.UTC().Format(time.RFC3339),
			}
		}
	}
}
