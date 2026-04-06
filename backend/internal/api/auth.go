// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// Sentinel errors for credential verification.
var (
	errLoginFailed     = errors.New("invalid username or password")
	errAccountDisabled = errors.New("account disabled")
)

// ─── Login ───────────────────────────────────────────────────────────────────

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}
	if body.Username == "" || body.Password == "" {
		jsonError(w, "username and password are required", http.StatusBadRequest)
		return
	}

	if h.loginRateLimited(w, r, body.Username) {
		return
	}

	user, err := h.verifyCredentials(r, body.Username, body.Password)
	if err != nil {
		switch {
		case errors.Is(err, errAccountDisabled):
			jsonError(w, err.Error(), http.StatusForbidden)
		default:
			jsonError(w, "invalid username or password", http.StatusUnauthorized)
		}
		return
	}

	h.completeLogin(w, r, user)
}

// loginRateLimited checks per-IP and per-user rate limits. Returns true if the
// request was rejected, in which case the HTTP response has already been written.
func (h *Handler) loginRateLimited(w http.ResponseWriter, r *http.Request, username string) bool {
	ip := clientIP(r)
	if !h.ipLimiter.Allow(ip) {
		metrics.RateLimitHitsTotal.WithLabelValues("per_ip").Inc()
		w.Header().Set("Retry-After", "900")
		jsonError(w, "too many login attempts, try again later", http.StatusTooManyRequests)
		return true
	}
	if !h.userLimiter.Allow(username) {
		metrics.RateLimitHitsTotal.WithLabelValues("per_username").Inc()
		w.Header().Set("Retry-After", "900")
		jsonError(w, "too many login attempts for this user, try again later", http.StatusTooManyRequests)
		return true
	}
	return false
}

// verifyCredentials looks up the user and checks the password. On failure it
// writes the HTTP error response and returns a non-nil error sentinel.
func (h *Handler) verifyCredentials(r *http.Request, username, password string) (*store.User, error) {
	user, err := h.store.GetUserByUsername(username)
	if err != nil {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		h.audit(r, "auth.login_failed", "user", nil, nil, map[string]string{"username": username, "reason": "unknown_user"})
		return nil, err
	}
	if !store.CheckPassword(user.PasswordHash, password) {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		h.audit(r, "auth.login_failed", "user", &user.ID, nil, map[string]string{"username": username, "reason": "bad_password"})
		return nil, errLoginFailed
	}
	if !user.Enabled {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "local").Inc()
		h.audit(r, "auth.login_failed", "user", &user.ID, nil, map[string]string{"username": username, "reason": "account_disabled"})
		return nil, errAccountDisabled
	}
	return user, nil
}

// completeLogin resets rate limiters, creates the session, and writes the
// success response.
func (h *Handler) completeLogin(w http.ResponseWriter, r *http.Request, user *store.User) {
	h.ipLimiter.Reset(clientIP(r))
	h.userLimiter.Reset(user.Username)
	metrics.AuthAttemptsTotal.WithLabelValues("success", "local").Inc()

	if err := h.createSessionCookies(w, r, user); err != nil {
		jsonInternalError(w, err, "create session failed")
		return
	}

	if err := h.store.UpdateLastLogin(user.ID); err != nil {
		slog.Warn("login: failed to update last_login_at", "userID", user.ID, "err", err)
	}
	h.audit(r, "auth.login", "user", &user.ID, nil, map[string]string{"username": user.Username, "method": "local"})

	jsonOK(w, map[string]interface{}{
		"user": userResponse(user),
	})
}

// ─── Logout ──────────────────────────────────────────────────────────────────

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("__kp_session")
	if err == nil && cookie.Value != "" {
		if delErr := h.store.DeleteSession(cookie.Value); delErr == nil {
			metrics.ActiveSessions.Dec()
		}
	}

	// Capture user before clearing cookies so method and ID are recorded.
	user := authmw.UserFromContext(r.Context())
	method := "local"
	if user != nil && user.Source == "oidc" {
		method = "oidc"
	}
	var userID *uint
	if user != nil {
		userID = &user.ID
	}
	h.audit(r, "auth.logout", "user", userID, nil, map[string]string{"method": method})
	clearSessionCookies(w)

	// For OIDC users, return the Keycloak end_session URL so the browser can
	// terminate the SSO session (RP-initiated logout). Without this, Keycloak's
	// session stays alive and SSO re-authenticates the user silently.
	if user != nil && user.Source == "oidc" &&
		h.oidcProvider != nil && h.oidcProvider.EndSessionURL != "" {

		postLogoutURI := oidcBaseURL(h.oidcCfg.RedirectURL)
		logoutURL := h.oidcProvider.EndSessionURL +
			"?client_id=" + url.QueryEscape(h.oidcCfg.ClientID) +
			"&post_logout_redirect_uri=" + url.QueryEscape(postLogoutURI)

		jsonOK(w, map[string]string{"oidcLogoutUrl": logoutURL})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// oidcBaseURL derives the app root URL from the OIDC redirect callback URL.
// e.g. "https://app.example.com/api/auth/oidc/callback" → "https://app.example.com/"
func oidcBaseURL(redirectURL string) string {
	u, err := url.Parse(redirectURL)
	if err != nil || u.Host == "" {
		return "/"
	}
	return u.Scheme + "://" + u.Host + "/"
}

// ─── Me ──────────────────────────────────────────────────────────────────────

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user := requireUser(w, r)
	if user == nil {
		return
	}

	perms := auth.PermissionsForRole(user.Role)
	permStrings := make([]string, len(perms))
	for i, p := range perms {
		permStrings[i] = string(p)
	}

	resp := userResponse(user)
	resp["permissions"] = permStrings
	jsonOK(w, resp)
}

// ─── Change password ─────────────────────────────────────────────────────────

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	user := requireUser(w, r)
	if user == nil {
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
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}
	if body.NewPassword == "" || len(body.NewPassword) < 8 {
		jsonError(w, "new password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if len(body.NewPassword) > 72 {
		jsonError(w, "password must be 72 characters or fewer", http.StatusBadRequest)
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
	h.audit(r, "auth.password_change", "user", &user.ID, nil, map[string]string{"method": "self-service"})
	w.WriteHeader(http.StatusNoContent)
}

// ─── Update user settings ───────────────────────────────────────────────────

func (h *Handler) updateUserSettings(w http.ResponseWriter, r *http.Request) {
	user := requireUser(w, r)
	if user == nil {
		return
	}

	var body struct {
		DefaultTimezone string `json:"defaultTimezone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}

	if body.DefaultTimezone != "" {
		if _, err := time.LoadLocation(body.DefaultTimezone); err != nil {
			jsonError(w, "invalid timezone", http.StatusBadRequest)
			return
		}
		oldTz := user.DefaultTimezone
		if err := h.store.UpdateUserTimezone(user.ID, body.DefaultTimezone); err != nil {
			jsonInternalError(w, err, "update user settings failed")
			return
		}
		user.DefaultTimezone = body.DefaultTimezone
		h.audit(r, "user.settings", "user", &user.ID,
			map[string]string{"defaultTimezone": oldTz},
			map[string]string{"defaultTimezone": body.DefaultTimezone})
	}

	jsonOK(w, userResponse(user))
}

// ─── List sessions ──────────────────────────────────────────────────────────

type sessionResponse struct {
	ID        uint   `json:"id"`
	IPAddress string `json:"ipAddress"`
	UserAgent string `json:"userAgent"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt"`
	IsCurrent bool   `json:"isCurrent"`
}

func (h *Handler) listSessions(w http.ResponseWriter, r *http.Request) {
	user := requireUser(w, r)
	if user == nil {
		return
	}

	sessions, err := h.store.ListUserSessions(user.ID)
	if err != nil {
		jsonInternalError(w, err, "list sessions failed")
		return
	}

	currentSessionID := authmw.SessionIDFromContext(r.Context())

	resp := make([]sessionResponse, len(sessions))
	for i, s := range sessions {
		resp[i] = sessionResponse{
			ID:        s.ID,
			IPAddress: s.IPAddress,
			UserAgent: s.UserAgent,
			CreatedAt: s.CreatedAt.Format(time.RFC3339),
			ExpiresAt: s.ExpiresAt.Format(time.RFC3339),
			IsCurrent: s.ID == currentSessionID,
		}
	}

	jsonOK(w, resp)
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
	metrics.ActiveSessions.Inc()

	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	csrfToken, err := authmw.GenerateCSRFToken()
	if err != nil {
		return err
	}
	authmw.SetCSRFCookie(w, csrfToken, h.cookieSecure)

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
		"id":              u.ID,
		"username":        u.Username,
		"givenName":       u.GivenName,
		"familyName":      u.FamilyName,
		"email":           u.Email,
		"role":            u.Role,
		"source":          u.Source,
		"enabled":         u.Enabled,
		"defaultTimezone": u.DefaultTimezone,
		"createdAt":       u.CreatedAt,
		"lastLoginAt":     u.LastLoginAt,
	}
}
