// SPDX-License-Identifier: Apache-2.0

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// Read requests remain accessible without CSRF tokens; the protection
// should apply to requests that can change state.
func TestCSRFProtect_GETExempt(t *testing.T) {
	handlerCalls := 0
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalls++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/schedules", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Errorf("GET should be exempt from CSRF, got %d", recorder.Code)
	}
	if handlerCalls != 1 {
		t.Errorf("handler calls = %d, want 1", handlerCalls)
	}
}

// Session cookies alone must not authorize a state-changing request.
// Missing CSRF proof should be rejected before the wrapped handler succeeds.
func TestCSRFProtect_POSTWithoutToken(t *testing.T) {
	handlerCalls := 0
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalls++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/schedules", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("POST without CSRF token should be 403, got %d", recorder.Code)
	}
	// A 403 response alone does not prove that the handler's side effects were blocked.
	if handlerCalls != 0 {
		t.Errorf("handler calls = %d, want 0 for a rejected request", handlerCalls)
	}
}

// The submitted header token must match the browser's CSRF cookie.
// Having both values present is insufficient if they disagree.
func TestCSRFProtect_POSTWithMismatch(t *testing.T) {
	handlerCalls := 0
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalls++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/schedules", nil)
	req.AddCookie(&http.Cookie{Name: "__kp_csrf", Value: "token-a"})
	req.Header.Set("X-CSRF-Token", "token-b")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("POST with mismatched CSRF token should be 403, got %d", recorder.Code)
	}
	if handlerCalls != 0 {
		t.Errorf("handler calls = %d, want 0 for a rejected request", handlerCalls)
	}
}

// Matching cookie and header tokens must allow a legitimate write request
// through the middleware.
func TestCSRFProtect_POSTWithValidToken(t *testing.T) {
	handlerCalls := 0
	handler := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalls++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/schedules", nil)
	req.AddCookie(&http.Cookie{Name: "__kp_csrf", Value: "valid-token"})
	req.Header.Set("X-CSRF-Token", "valid-token")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Errorf("POST with valid CSRF token should be 200, got %d", recorder.Code)
	}
	if handlerCalls != 1 {
		t.Errorf("handler calls = %d, want 1", handlerCalls)
	}
}

// A permission check requires an authenticated identity. Without one,
// return unauthorized before consulting a role or invoking the handler.
func TestRequirePermission_NoUser(t *testing.T) {
	handlerCalls := 0
	handler := RequirePermission("schedule.edit")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalls++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("no user in context should be 401, got %d", recorder.Code)
	}
	if handlerCalls != 0 {
		t.Errorf("handler calls = %d, want 0 for an unauthenticated request", handlerCalls)
	}
}

// An authenticated identity must still have the requested permission. Exercise
// the middleware boundary so correct role definitions cannot hide a bypass here.
func TestRequirePermission_AuthenticatedRoles(t *testing.T) {
	tests := []struct {
		name             string
		role             string
		permission       auth.Permission
		wantStatus       int
		wantHandlerCalls int
	}{
		{name: "viewer can read", role: "viewer", permission: auth.PermViewAll, wantStatus: http.StatusOK, wantHandlerCalls: 1},
		{name: "viewer cannot edit schedules", role: "viewer", permission: auth.PermScheduleEdit, wantStatus: http.StatusForbidden},
		{name: "operator can edit schedules", role: "operator", permission: auth.PermScheduleEdit, wantStatus: http.StatusOK, wantHandlerCalls: 1},
		{name: "operator cannot manage users", role: "operator", permission: auth.PermUserManage, wantStatus: http.StatusForbidden},
		{name: "admin can manage users", role: "admin", permission: auth.PermUserManage, wantStatus: http.StatusOK, wantHandlerCalls: 1},
		{name: "unknown role has no access", role: "unknown", permission: auth.PermViewAll, wantStatus: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handlerCalls := 0
			handler := RequirePermission(tt.permission)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handlerCalls++
				w.WriteHeader(http.StatusOK)
			}))
			user := &store.User{Role: tt.role, Enabled: true}
			ctx := context.WithValue(t.Context(), ctxUserKey{}, user)
			req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			if recorder.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
			if handlerCalls != tt.wantHandlerCalls {
				t.Errorf("handler calls = %d, want %d", handlerCalls, tt.wantHandlerCalls)
			}
		})
	}
}

// An unauthenticated request has no user in its context. Callers must be
// able to detect that absence without a panic or a fabricated identity.
func TestUserFromContext_Nil(t *testing.T) {
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)
	user := UserFromContext(req.Context())
	if user != nil {
		t.Error("expected nil user from empty context")
	}
}
