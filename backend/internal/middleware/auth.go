package middleware

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// wsTokenKey is the context key used to pass the WebSocket auth token between
// RedactWSToken (which strips it from the URL before the logger sees it) and
// BasicAuth (which reads it back for credential verification).
type wsTokenKey struct{}

// RedactWSToken must be registered BEFORE the request logger middleware.
// It moves the ?token= query parameter into the request context and replaces
// its URL value with "[REDACTED]", so access logs never contain raw credentials.
func RedactWSToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if t := r.URL.Query().Get("token"); t != "" {
			// Stash real token in context for BasicAuth to consume.
			ctx := context.WithValue(r.Context(), wsTokenKey{}, t)
			// Clone the URL so we don't mutate the original, then redact.
			u2 := *r.URL
			q := url.Values{}
			for k, v := range r.URL.Query() {
				q[k] = v
			}
			q.Set("token", "[REDACTED]")
			u2.RawQuery = q.Encode()
			r2 := r.Clone(ctx)
			r2.URL = &u2
			next.ServeHTTP(w, r2)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// BasicAuth returns a middleware that enforces HTTP Basic Auth.
// Credentials are read from BASIC_AUTH_USER and BASIC_AUTH_PASSWORD env vars.
// If the env vars are not set, auth is skipped (useful for local dev without a password).
//
// When Keycloak OIDC is integrated later, replace this middleware with an OIDC handler
// while keeping the same middleware slot in the router.
func BasicAuth(next http.Handler) http.Handler {
	user := os.Getenv("BASIC_AUTH_USER")
	pass := os.Getenv("BASIC_AUTH_PASSWORD")

	// If credentials are not configured, skip auth (local dev mode)
	if user == "" || pass == "" {
		slog.Warn("basic-auth: credentials not configured — authentication disabled (dev mode)")
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, p, ok := r.BasicAuth()

		// Browsers cannot set Authorization headers on WebSocket upgrades.
		// Accept a ?token=<base64(user:pass)> query param as fallback.
		// The token is read from the request context (placed there by RedactWSToken)
		// so that the value never appears in raw form in the access log.
		if !ok && r.Header.Get("Upgrade") == "websocket" {
			if t, _ := r.Context().Value(wsTokenKey{}).(string); t != "" {
				decoded, err := base64.StdEncoding.DecodeString(t)
				if err == nil {
					if parts := strings.SplitN(string(decoded), ":", 2); len(parts) == 2 {
						u, p, ok = parts[0], parts[1], true
					}
				}
			}
		}

		if !ok || subtle.ConstantTimeCompare([]byte(u), []byte(user)) != 1 ||
			subtle.ConstantTimeCompare([]byte(p), []byte(pass)) != 1 {
			slog.Warn("basic-auth: unauthorized request", "remote_addr", r.RemoteAddr, "method", r.Method, "path", r.URL.Path)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
