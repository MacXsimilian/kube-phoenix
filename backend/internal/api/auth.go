package api

import (
	"encoding/json"
	"net/http"
	"net/url"
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
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
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
		if delErr := h.store.DeleteSession(cookie.Value); delErr == nil {
			metrics.ActiveSessions.Dec()
		}
	}

	h.audit(r, "auth.logout", "", nil, nil, nil)
	clearSessionCookies(w)

	// For OIDC users, return the Keycloak end_session URL so the browser can
	// terminate the SSO session (RP-initiated logout). Without this, Keycloak's
	// session stays alive and SSO re-authenticates the user silently.
	user := authmw.UserFromContext(r.Context())
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
		"givenName":   user.GivenName,
		"familyName":  user.FamilyName,
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
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
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
	metrics.ActiveSessions.Inc()

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
		"givenName":   u.GivenName,
		"familyName":  u.FamilyName,
		"email":       u.Email,
		"role":        u.Role,
		"source":      u.Source,
		"enabled":     u.Enabled,
		"createdAt":   u.CreatedAt,
		"lastLoginAt": u.LastLoginAt,
	}
}
