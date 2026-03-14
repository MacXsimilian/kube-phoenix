package middleware

import (
	"crypto/subtle"
	"encoding/base64"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

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
		if !ok && r.Header.Get("Upgrade") == "websocket" {
			if t := r.URL.Query().Get("token"); t != "" {
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
			w.Header().Set("WWW-Authenticate", `Basic realm="kube-phoenix"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
