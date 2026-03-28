package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
)

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
	jsonOK(w, h.buildOverview())
}

// streamCluster streams OverviewResponse updates as Server-Sent Events.
// Each cache rebuild pushes a new event to all connected clients.
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

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx response buffering
	w.WriteHeader(http.StatusOK)

	// Send current state immediately so the client gets data before the first tick
	h.writeSSEOverview(w, flusher)

	ch := h.cache.Subscribe()
	defer h.cache.Unsubscribe(ch)

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ch:
			h.writeSSEOverview(w, flusher)
		}
	}
}

func (h *Handler) writeSSEOverview(w http.ResponseWriter, flusher http.Flusher) {
	data, err := json.Marshal(h.buildOverview())
	if err != nil {
		return
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		return
	}
	flusher.Flush()
}

func (h *Handler) buildOverview() OverviewResponse {
	resp := OverviewResponse{
		ClusterStatus: "awake",
		SleepingByNs:  []NsSleepCount{},
	}

	if h.cache != nil {
		if snap := h.cache.Snapshot(); snap.Ready() {
			resp.CacheAgeMs = snap.AgeMs()
			populateWorkloadCounts(&resp, snap)
		}
	}

	h.populateNextRun(&resp)
	return resp
}

// replicaInfo holds the fields needed to classify a workload's sleep status.
type replicaInfo struct {
	Namespace   string
	Replicas    *int32
	Annotations map[string]string
}

// countWorkloads tallies running vs sleeping workloads and tracks sleeping-by-namespace.
func countWorkloads(items []replicaInfo) (running, sleeping int, nsSleep map[string]int) {
	nsSleep = map[string]int{}
	for _, item := range items {
		current := int32(0)
		if item.Replicas != nil {
			current = *item.Replicas
		}
		saved := parseSavedReplicas(item.Annotations)
		if workloadStatus(current, saved) == "sleeping" {
			sleeping++
			nsSleep[item.Namespace]++
		} else {
			running++
		}
	}
	return
}

func parseSavedReplicas(annotations map[string]string) *int32 {
	v, ok := annotations["previous-replicas"]
	if !ok {
		return nil
	}
	n, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		return nil
	}
	n32 := int32(n)
	return &n32
}

func populateWorkloadCounts(resp *OverviewResponse, snap k8s.CachedSnapshot) {
	items := make([]replicaInfo, 0, len(snap.Deployments)+len(snap.StatefulSets))
	for _, d := range snap.Deployments {
		items = append(items, replicaInfo{Namespace: d.Namespace, Replicas: d.Spec.Replicas, Annotations: d.Annotations})
	}
	for _, ss := range snap.StatefulSets {
		items = append(items, replicaInfo{Namespace: ss.Namespace, Replicas: ss.Spec.Replicas, Annotations: ss.Annotations})
	}

	running, sleeping, nsSleep := countWorkloads(items)

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
	var earliestTime *time.Time
	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		nextTransition := h.policyScheduler.NextTransition(p.ID)
		if nextTransition != nil {
			if earliestTime == nil || nextTransition.Before(*earliestTime) {
				earliestTime = nextTransition
				resp.NextRun = &NextRunInfo{
					Name:    p.Name,
					NextRun: nextTransition.UTC().Format(time.RFC3339),
				}
			}
		}
	}
}
