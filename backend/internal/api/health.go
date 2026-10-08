package api

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

func registerHealthRoutes(r chi.Router, ping func(context.Context) error) {
	r.Get("/livez", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	ready := func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		if err := ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"error","error":"database unavailable"}`))
			return
		}
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}
	r.Get("/readyz", ready)
	r.Get("/healthz", ready) // compatibility with existing readiness consumers
}
