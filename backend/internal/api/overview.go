package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"
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
// Each cache refresh (every ~10 s) pushes a new event to all connected clients.
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
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}

func (h *Handler) buildOverview() OverviewResponse {
	resp := OverviewResponse{
		ClusterStatus: "awake",
		SleepingByNs:  []NsSleepCount{},
	}

	if h.cache != nil {
		snap := h.cache.Snapshot()
		if snap.Ready() {
			resp.CacheAgeMs = snap.AgeMs()

			running, sleeping := 0, 0
			nsSleep := map[string]int{}

			for _, d := range snap.Deployments {
				current := int32(0)
				if d.Spec.Replicas != nil {
					current = *d.Spec.Replicas
				}
				var saved *int32
				if v, ok := d.Annotations["previous-replicas"]; ok {
					if n, err := strconv.ParseInt(v, 10, 32); err == nil {
						n32 := int32(n)
						saved = &n32
					}
				}
				if workloadStatus(current, saved) == "sleeping" {
					sleeping++
					nsSleep[d.Namespace]++
				} else {
					running++
				}
			}

			for _, ss := range snap.StatefulSets {
				current := int32(0)
				if ss.Spec.Replicas != nil {
					current = *ss.Spec.Replicas
				}
				var saved *int32
				if v, ok := ss.Annotations["previous-replicas"]; ok {
					if n, err := strconv.ParseInt(v, 10, 32); err == nil {
						n32 := int32(n)
						saved = &n32
					}
				}
				if workloadStatus(current, saved) == "sleeping" {
					sleeping++
					nsSleep[ss.Namespace]++
				} else {
					running++
				}
			}

			resp.RunningCount = running
			resp.SleepingCount = sleeping
			resp.NodeCount = len(snap.Nodes)

			switch {
			case sleeping > 0 && running == 0:
				resp.ClusterStatus = "sleeping"
			case sleeping > 0:
				resp.ClusterStatus = "partial"
			}

			// Top sleeping namespaces (up to 4), sorted by count desc
			type nsEntry struct {
				name  string
				count int
			}
			var nsList []nsEntry
			for name, count := range nsSleep {
				nsList = append(nsList, nsEntry{name, count})
			}
			sort.Slice(nsList, func(i, j int) bool { return nsList[i].count > nsList[j].count })
			if len(nsList) > 4 {
				nsList = nsList[:4]
			}
			for _, ns := range nsList {
				resp.SleepingByNs = append(resp.SleepingByNs, NsSleepCount{Namespace: ns.name, Count: ns.count})
			}
		}
	}

	// Next scheduled run — scheduler.NextRun is an in-memory lookup, no I/O
	schedules, err := h.store.ListSchedules()
	if err == nil {
		var earliestTime *time.Time
		for _, s := range schedules {
			if !s.Enabled {
				continue
			}
			t := h.scheduler.NextRun(s.ID)
			if t == nil {
				continue
			}
			if earliestTime == nil || t.Before(*earliestTime) {
				earliestTime = t
				resp.NextRun = &NextRunInfo{
					Name:    s.Name,
					NextRun: t.UTC().Format(time.RFC3339),
				}
			}
		}
	}

	return resp
}
