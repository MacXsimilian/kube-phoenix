package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"golang.org/x/oauth2"
)

// oidcConfig returns the OIDC endpoint configuration for the frontend.
func (h *Handler) oidcConfig(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]interface{}{
		"enabled": h.oidcProvider != nil,
	})
}

// oidcLogin redirects the user to the Keycloak authorization endpoint.
func (h *Handler) oidcLogin(w http.ResponseWriter, r *http.Request) {
	if h.oidcProvider == nil {
		jsonError(w, "OIDC not configured", http.StatusNotFound)
		return
	}

	state, err := auth.GenerateState()
	if err != nil {
		jsonInternalError(w, err, "generate OIDC state failed")
		return
	}

	// Store state in a short-lived HTTP-only cookie.
	secure := os.Getenv("COOKIE_SECURE") != "false"
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_oidc_state",
		Value:    state,
		Path:     "/api/auth/oidc",
		MaxAge:   300, // 5 minutes
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode, // Lax required for cross-site redirect
	})

	url := h.oidcProvider.OAuth2.AuthCodeURL(state, oauth2.S256ChallengeOption(state))
	http.Redirect(w, r, url, http.StatusFound)
}

// oidcCallback handles the redirect from Keycloak after authentication.
func (h *Handler) oidcCallback(w http.ResponseWriter, r *http.Request) {
	if h.oidcProvider == nil {
		jsonError(w, "OIDC not configured", http.StatusNotFound)
		return
	}

	// Validate state.
	stateCookie, err := r.Cookie("__kp_oidc_state")
	if err != nil || stateCookie.Value == "" {
		slog.Warn("oidc: missing state cookie")
		jsonError(w, "invalid OIDC state", http.StatusBadRequest)
		return
	}
	if r.URL.Query().Get("state") != stateCookie.Value {
		slog.Warn("oidc: state mismatch")
		jsonError(w, "invalid OIDC state", http.StatusBadRequest)
		return
	}

	// Clear state cookie.
	http.SetCookie(w, &http.Cookie{
		Name:   "__kp_oidc_state",
		Value:  "",
		Path:   "/api/auth/oidc",
		MaxAge: -1,
	})

	// Exchange authorization code for tokens.
	code := r.URL.Query().Get("code")
	if code == "" {
		jsonError(w, "missing authorization code", http.StatusBadRequest)
		return
	}

	token, err := h.oidcProvider.OAuth2.Exchange(r.Context(), code, oauth2.VerifierOption(stateCookie.Value))
	if err != nil {
		slog.Error("oidc: token exchange failed", "err", err)
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	// Extract and verify ID token.
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		slog.Error("oidc: no id_token in response")
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	idToken, err := h.oidcProvider.Verifier.Verify(r.Context(), rawIDToken)
	if err != nil {
		slog.Error("oidc: id_token verification failed", "err", err)
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	// Extract claims.
	var claims struct {
		Sub               string   `json:"sub"`
		PreferredUsername  string   `json:"preferred_username"`
		Email             string   `json:"email"`
		Groups            []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		slog.Error("oidc: claims extraction failed", "err", err)
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	// Also check for groups under the configured claim name if different.
	if h.oidcProvider.GroupsClaim != "groups" {
		var extra map[string]json.RawMessage
		if err := idToken.Claims(&extra); err == nil {
			if raw, ok := extra[h.oidcProvider.GroupsClaim]; ok {
				var groups []string
				if json.Unmarshal(raw, &groups) == nil {
					claims.Groups = groups
				}
			}
		}
	}

	if claims.Sub == "" {
		slog.Error("oidc: empty sub claim in id_token")
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	if len(claims.Groups) == 0 {
		slog.Warn("oidc: no groups in token — user will be assigned viewer role",
			"sub", claims.Sub, "username", claims.PreferredUsername, "claim", h.oidcProvider.GroupsClaim)
	}

	// Map groups to role.
	role := auth.MapGroupsToRole(claims.Groups, h.oidcProvider.AdminGroups, h.oidcProvider.OpGroups)

	username := claims.PreferredUsername
	if username == "" {
		username = claims.Sub
	}

	// Upsert user.
	user, err := h.store.GetOrCreateOIDCUser(claims.Sub, username, claims.Email, role)
	if err != nil {
		jsonInternalError(w, err, "oidc user upsert failed")
		return
	}

	if !user.Enabled {
		slog.Warn("oidc: disabled user attempted login", "username", user.Username, "sub", claims.Sub)
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		// Redirect to login page with error.
		http.Redirect(w, r, "/?error=account_disabled", http.StatusFound)
		return
	}

	// Create session.
	metrics.AuthAttemptsTotal.WithLabelValues("success", "oidc").Inc()
	_ = h.store.UpdateLastLogin(user.ID)

	sessToken, err := store.GenerateToken()
	if err != nil {
		jsonInternalError(w, err, "generate session token failed")
		return
	}

	now := time.Now()
	sess := &store.Session{
		Token:        sessToken,
		UserID:       user.ID,
		IPAddress:    r.RemoteAddr,
		UserAgent:    r.UserAgent(),
		ExpiresAt:    now.Add(h.idleTimeout),
		MaxExpiresAt: now.Add(h.maxLifetime),
		CreatedAt:    now,
	}
	if err := h.store.CreateSession(sess); err != nil {
		jsonInternalError(w, err, "create session failed")
		return
	}

	// Set session + CSRF cookies.
	secure := os.Getenv("COOKIE_SECURE") != "false"
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_session",
		Value:    sessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
	csrfToken, err := authmw.GenerateCSRFToken()
	if err != nil {
		jsonInternalError(w, err, "generate CSRF token failed")
		return
	}
	authmw.SetCSRFCookie(w, csrfToken, secure)

	h.audit(r, "auth.login", "user", &user.ID, nil, map[string]string{"username": user.Username, "method": "oidc"})

	// Redirect to frontend.
	http.Redirect(w, r, "/", http.StatusFound)
}
