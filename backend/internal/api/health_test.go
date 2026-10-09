package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// A database outage should fail readiness while liveness stays healthy, avoiding
// restarts of an otherwise serving process. Legacy health retains readiness behavior.
func TestLivenessSurvivesDatabaseOutage(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		wantStatus    int
		wantPingCalls int
	}{
		{name: "liveness", path: "/livez", wantStatus: http.StatusOK, wantPingCalls: 0},
		{name: "readiness", path: "/readyz", wantStatus: http.StatusServiceUnavailable, wantPingCalls: 1},
		{name: "legacy health", path: "/healthz", wantStatus: http.StatusServiceUnavailable, wantPingCalls: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := chi.NewRouter()
			pingCalls := 0
			registerHealthRoutes(router, func(ctx context.Context) error {
				pingCalls++
				if _, ok := ctx.Deadline(); !ok {
					t.Error("database ping must have a deadline")
				}
				return errors.New("database unavailable")
			})

			response := httptest.NewRecorder()
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.path, nil)
			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, tt.wantStatus)
			}
			if pingCalls != tt.wantPingCalls {
				t.Errorf("database pings = %d, want %d", pingCalls, tt.wantPingCalls)
			}
		})
	}
}
