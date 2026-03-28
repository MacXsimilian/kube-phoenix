package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"golang.org/x/oauth2"
)

// errMissingIDToken is returned when the token response contains no id_token field.
var errMissingIDToken = errors.New("oidc: id_token missing from token response")

// oidcClaims holds the extracted claims from an ID token.
type oidcClaims struct {
	Sub               string
	PreferredUsername string
	Email             string
	GivenName         string
	FamilyName        string
	Groups            []string
}

// oidcConfig returns the OIDC configuration status for the frontend.
func (h *Handler) oidcConfig(w http.ResponseWriter, r *http.Request) {
	resp := map[string]interface{}{
		"enabled": h.oidcProvider != nil,
		"mounted": h.oidcCfg != nil,
	}
	if h.oidcCfg != nil {
		groupsClaim := h.oidcCfg.GroupsClaim
		if groupsClaim == "" {
			groupsClaim = "groups"
		}
		resp["issuerURL"] = h.oidcCfg.IssuerURL
		resp["clientID"] = h.oidcCfg.ClientID
		resp["redirectURL"] = h.oidcCfg.RedirectURL
		resp["groupsClaim"] = groupsClaim
		resp["roleAdminGroups"] = h.oidcCfg.AdminGroups
		resp["roleOperatorGroups"] = h.oidcCfg.OperatorGroups
	}
	jsonOK(w, resp)
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

	verifier, err := auth.GeneratePKCEVerifier()
	if err != nil {
		jsonInternalError(w, err, "generate PKCE verifier failed")
		return
	}

	// Store state and PKCE verifier in short-lived HTTP-only cookies.
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_oidc_state",
		Value:    state,
		Path:     "/api/auth/oidc",
		MaxAge:   300, // 5 minutes
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode, // Lax required for cross-site redirect
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "__kp_oidc_verifier",
		Value:    verifier,
		Path:     "/api/auth/oidc",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	url := h.oidcProvider.OAuth2.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
	http.Redirect(w, r, url, http.StatusFound)
}

// oidcCallback handles the redirect from Keycloak after authentication.
func (h *Handler) oidcCallback(w http.ResponseWriter, r *http.Request) {
	if h.oidcProvider == nil {
		jsonError(w, "OIDC not configured", http.StatusNotFound)
		return
	}

	verifier, ok := h.oidcValidateAndClearCookies(w, r)
	if !ok {
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		jsonError(w, "missing authorization code", http.StatusBadRequest)
		return
	}

	idToken, err := h.oidcExchangeAndVerify(r.Context(), code, verifier)
	if err != nil {
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	claims, ok := oidcExtractClaims(idToken, h.oidcProvider.GroupsClaim)
	if !ok {
		jsonError(w, "OIDC authentication failed", http.StatusUnauthorized)
		return
	}

	user, err := h.resolveOIDCUser(claims)
	if err != nil {
		jsonInternalError(w, err, "oidc user upsert failed")
		return
	}

	if !user.Enabled {
		slog.Warn("oidc: disabled user attempted login", "username", user.Username, "sub", claims.Sub)
		metrics.AuthAttemptsTotal.WithLabelValues("failure", "oidc").Inc()
		http.Redirect(w, r, "/?error=account_disabled", http.StatusFound)
		return
	}

	h.completeOIDCLogin(w, r, user)
}

// resolveOIDCUser maps OIDC claims to a local user record, creating or updating
// as necessary.
func (h *Handler) resolveOIDCUser(claims oidcClaims) (*store.User, error) {
	if len(claims.Groups) == 0 {
		slog.Warn("oidc: no groups in token — user will be assigned viewer role",
			"sub", claims.Sub, "username", claims.PreferredUsername, "claim", h.oidcProvider.GroupsClaim)
	}

	role := auth.MapGroupsToRole(claims.Groups, h.oidcProvider.AdminGroups, h.oidcProvider.OpGroups)
	username := claims.PreferredUsername
	if username == "" {
		username = claims.Sub
	}

	return h.store.GetOrCreateOIDCUser(store.OIDCUserInfo{
		Sub:        claims.Sub,
		Username:   username,
		Email:      claims.Email,
		Role:       role,
		GivenName:  claims.GivenName,
		FamilyName: claims.FamilyName,
	})
}

// completeOIDCLogin finalises the OIDC login flow by creating the session,
// recording metrics, and redirecting to the app root.
func (h *Handler) completeOIDCLogin(w http.ResponseWriter, r *http.Request, user *store.User) {
	metrics.AuthAttemptsTotal.WithLabelValues("success", "oidc").Inc()
	if err := h.store.UpdateLastLogin(user.ID); err != nil {
		slog.Warn("oidc: failed to update last_login_at", "userID", user.ID, "err", err)
	}

	if err := h.createSessionCookies(w, r, user); err != nil {
		jsonInternalError(w, err, "create session failed")
		return
	}

	h.audit(r, "auth.login", "user", &user.ID, nil, map[string]string{"username": user.Username, "method": "oidc"})
	http.Redirect(w, r, "/", http.StatusFound)
}

// oidcValidateAndClearCookies validates the OIDC state and PKCE verifier cookies,
// clears them, and returns the PKCE verifier value.
func (h *Handler) oidcValidateAndClearCookies(w http.ResponseWriter, r *http.Request) (string, bool) {
	stateCookie, err := r.Cookie("__kp_oidc_state")
	if err != nil || stateCookie.Value == "" {
		slog.Warn("oidc: missing state cookie")
		jsonError(w, "invalid OIDC state", http.StatusBadRequest)
		return "", false
	}
	if r.URL.Query().Get("state") != stateCookie.Value {
		slog.Warn("oidc: state mismatch")
		jsonError(w, "invalid OIDC state", http.StatusBadRequest)
		return "", false
	}

	verifierCookie, err := r.Cookie("__kp_oidc_verifier")
	if err != nil || verifierCookie.Value == "" {
		slog.Warn("oidc: missing PKCE verifier cookie")
		jsonError(w, "invalid OIDC state", http.StatusBadRequest)
		return "", false
	}

	http.SetCookie(w, &http.Cookie{Name: "__kp_oidc_state", Value: "", Path: "/api/auth/oidc", MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: "__kp_oidc_verifier", Value: "", Path: "/api/auth/oidc", MaxAge: -1})
	return verifierCookie.Value, true
}

// oidcExchangeAndVerify exchanges the authorization code for tokens and verifies the ID token.
func (h *Handler) oidcExchangeAndVerify(ctx context.Context, code, verifier string) (*gooidc.IDToken, error) {
	exchCtx := ctx
	if h.oidcProvider.HTTPClient != nil {
		exchCtx = context.WithValue(ctx, oauth2.HTTPClient, h.oidcProvider.HTTPClient)
	}

	token, err := h.oidcProvider.OAuth2.Exchange(exchCtx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, fmt.Errorf("oidc: token exchange: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, errMissingIDToken
	}

	idToken, err := h.oidcProvider.Verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("oidc: id_token verification: %w", err)
	}
	return idToken, nil
}

// oidcExtractClaims extracts standard claims and the configured groups claim from an ID token.
func oidcExtractClaims(idToken *gooidc.IDToken, groupsClaim string) (oidcClaims, bool) {
	var raw struct {
		Sub               string   `json:"sub"`
		PreferredUsername string   `json:"preferred_username"`
		Email             string   `json:"email"`
		GivenName         string   `json:"given_name"`
		FamilyName        string   `json:"family_name"`
		Groups            []string `json:"groups"`
	}
	if err := idToken.Claims(&raw); err != nil {
		return oidcClaims{}, false
	}
	if raw.Sub == "" {
		return oidcClaims{}, false
	}

	groups := raw.Groups
	if groupsClaim != "groups" {
		var extra map[string]json.RawMessage
		if err := idToken.Claims(&extra); err == nil {
			if data, ok := extra[groupsClaim]; ok {
				var g []string
				if json.Unmarshal(data, &g) == nil {
					groups = g
				}
			}
		}
	}

	return oidcClaims{
		Sub:               raw.Sub,
		PreferredUsername: raw.PreferredUsername,
		Email:             raw.Email,
		GivenName:         raw.GivenName,
		FamilyName:        raw.FamilyName,
		Groups:            groups,
	}, true
}
