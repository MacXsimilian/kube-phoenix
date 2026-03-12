package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"
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
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// WebSocket upgrades also require auth
		u, p, ok := r.BasicAuth()
		if !ok || subtle.ConstantTimeCompare([]byte(u), []byte(user)) != 1 ||
			subtle.ConstantTimeCompare([]byte(p), []byte(pass)) != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="kube-phoenix"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
