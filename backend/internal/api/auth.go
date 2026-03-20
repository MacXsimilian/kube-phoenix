package api

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ─── Login ───────────────────────────────────────────────────────────────────

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Username == "" || body.Password == "" {
		jsonError(w, "username and password are required", http.StatusBadRequest)
		return
	}

	// Rate limiting.
	ip := r.RemoteAddr
	if !h.ipLimiter.Allow(ip) {
		metrics.RateLimitHitsTotal.WithLabelValues("per_ip").Inc()
		w.Header().Set("Retry-After", "900")
		jsonError(w, "too many login attempts, try again later", http.StatusTooManyRequests)
		return
	}
	if !h.userLimiter.Allow(body.Username) {
		metrics.RateLimitHitsTotal.WithLabelValues("per_username").Inc()
		w.Header().Set("Retry-After", "900")
		jsonError(w, "too many login attempts for this user, try again later", http.StatusTooManyRequests)
		return
	}

	user, err := h.store.GetUserByUsername(body.Username)
	if err != nil {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		jsonError(w, "invalid username or password", http.StatusUnauthorized)
		return
	}
	if !store.CheckPassword(user.PasswordHash, body.Password) {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		jsonError(w, "invalid username or password", http.StatusUnauthorized)
		return
	}

	if !user.Enabled {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		jsonError(w, "account disabled", http.StatusForbidden)
		return
	}

	// Success — reset rate limiters, create session.
	h.ipLimiter.Reset(ip)
	h.userLimiter.Reset(body.Username)
	metrics.AuthAttemptsTotal.WithLabelValues("success", "local").Inc()

	if err := h.createSessionCookies(w, r, user); err != nil {
		jsonInternalError(w, err, "create session failed")
		return
	}

	_ = h.store.UpdateLastLogin(user.ID)
	h.audit(r, "auth.login", "user", &user.ID, nil, map[string]string{"username": user.Username, "method": "local"})

	jsonOK(w, map[string]interface{}{
		"user": userResponse(user),
	})
}

// ─── Logout ──────────────────────────────────────────────────────────────────

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("__kp_session")
	if err == nil && cookie.Value != "" {
		_ = h.store.DeleteSession(cookie.Value)
	}

	h.audit(r, "auth.logout", "", nil, nil, nil)
	clearSessionCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Me ──────────────────────────────────────────────────────────────────────

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user := authmw.UserFromContext(r.Context())
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	perms := auth.PermissionsForRole(user.Role)
	permStrings := make([]string, len(perms))
	for i, p := range perms {
		permStrings[i] = string(p)
	}

	jsonOK(w, map[string]interface{}{
		"id":          user.ID,
		"username":    user.Username,
		"email":       user.Email,
		"role":        user.Role,
		"source":      user.Source,
		"enabled":     user.Enabled,
		"permissions": permStrings,
		"createdAt":   user.CreatedAt,
		"lastLoginAt": user.LastLoginAt,
	})
}

// ─── Change password ─────────────────────────────────────────────────────────

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	user := authmw.UserFromContext(r.Context())
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if user.Source != "local" {
		jsonError(w, "password change not available for SSO users", http.StatusForbidden)
		return
	}

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.NewPassword == "" || len(body.NewPassword) < 8 {
		jsonError(w, "new password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if !store.CheckPassword(user.PasswordHash, body.CurrentPassword) {
		jsonError(w, "current password is incorrect", http.StatusUnauthorized)
		return
	}

	if err := h.store.ChangePassword(user.ID, body.NewPassword); err != nil {
		jsonInternalError(w, err, "change password failed")
		return
	}
	h.audit(r, "auth.password_change", "user", &user.ID, nil, nil)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Session helpers ─────────────────────────────────────────────────────────

func (h *Handler) createSessionCookies(w http.ResponseWriter, r *http.Request, user *store.User) error {
	token, err := store.GenerateToken()
	if err != nil {
		return err
	}

	now := time.Now()
	sess := &store.Session{
		Token:        token,
		UserID:       user.ID,
		IPAddress:    r.RemoteAddr,
		UserAgent:    r.UserAgent(),
		ExpiresAt:    now.Add(h.idleTimeout),
		MaxExpiresAt: now.Add(h.maxLifetime),
		CreatedAt:    now,
	}
	if err := h.store.CreateSession(sess); err != nil {
		return err
	}

	secure := os.Getenv("COOKIE_SECURE") != "false" // secure by default
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})

	csrfToken, err := authmw.GenerateCSRFToken()
	if err != nil {
		return err
	}
	authmw.SetCSRFCookie(w, csrfToken, secure)

	return nil
}

func clearSessionCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_csrf",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		SameSite: http.SameSiteStrictMode,
	})
}

func userResponse(u *store.User) map[string]interface{} {
	return map[string]interface{}{
		"id":          u.ID,
		"username":    u.Username,
		"email":       u.Email,
		"role":        u.Role,
		"source":      u.Source,
		"enabled":     u.Enabled,
		"createdAt":   u.CreatedAt,
		"lastLoginAt": u.LastLoginAt,
	}
}
