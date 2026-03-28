package api

import (
	"net/http"
	"runtime"
	"time"
)

var startTime = time.Now()

// Version is set at build time via -ldflags.
var Version = "dev"

func (h *Handler) getVersion(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{
		"version":   Version,
		"goVersion": runtime.Version(),
		"uptime":    time.Since(startTime).Truncate(time.Second).String(),
	})
}
