package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCSRFProtect_GETExempt(t *testing.T) {
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/schedules", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("GET should be exempt from CSRF, got %d", rr.Code)
	}
}

func TestCSRFProtect_POSTWithoutToken(t *testing.T) {
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/schedules", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("POST without CSRF token should be 403, got %d", rr.Code)
	}
}

func TestCSRFProtect_POSTWithMismatch(t *testing.T) {
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/schedules", nil)
	req.AddCookie(&http.Cookie{Name: "__kp_csrf", Value: "token-a"})
	req.Header.Set("X-CSRF-Token", "token-b")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("POST with mismatched CSRF token should be 403, got %d", rr.Code)
	}
}

func TestCSRFProtect_POSTWithValidToken(t *testing.T) {
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/schedules", nil)
	req.AddCookie(&http.Cookie{Name: "__kp_csrf", Value: "valid-token"})
	req.Header.Set("X-CSRF-Token", "valid-token")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("POST with valid CSRF token should be 200, got %d", rr.Code)
	}
}

func TestRequirePermission_NoUser(t *testing.T) {
	handler := RequirePermission("schedule.edit")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("no user in context should be 401, got %d", rr.Code)
	}
}

func TestUserFromContext_Nil(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	user := UserFromContext(req.Context())
	if user != nil {
		t.Error("expected nil user from empty context")
	}
}
