package api

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestLivenessSurvivesDatabaseOutage(t *testing.T) {
	r := chi.NewRouter()
	calls := 0
	registerHealthRoutes(r, func(ctx context.Context) error {
		calls++
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("readiness ping is unbounded")
		}
		return errors.New("database unavailable")
	})
	for path, want := range map[string]int{"/livez": 200, "/readyz": 503, "/healthz": 503} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != want {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	if calls != 2 {
		t.Fatalf("liveness contacted database: %d pings", calls)
	}
}
