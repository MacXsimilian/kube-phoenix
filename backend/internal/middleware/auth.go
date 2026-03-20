package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ─── Context keys ────────────────────────────────────────────────────────────

type ctxUserKey struct{}

// UserFromContext returns the authenticated user, or nil if unauthenticated.
func UserFromContext(ctx context.Context) *store.User {
	u, _ := ctx.Value(ctxUserKey{}).(*store.User)
	return u
}

// ─── Session Auth (cookie-based) ─────────────────────────────────────────────

// SessionAuth reads the __kp_session HTTP-only cookie, looks up the session in
// the database, places the User into the request context, and extends the
// sliding-window expiry.
func SessionAuth(st *store.Store, idleTimeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("__kp_session")
			if err != nil || cookie.Value == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			sess, err := st.GetSessionByToken(cookie.Value)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if !sess.User.Enabled {
				slog.Warn("session-auth: disabled user attempted access", "userID", sess.User.ID, "username", sess.User.Username)
				http.Error(w, `{"error":"account disabled"}`, http.StatusForbidden)
				return
			}

			// Extend sliding window (capped at max_expires_at by the store).
			if err := st.ExtendSession(cookie.Value, idleTimeout); err != nil {
				slog.Warn("session-auth: extend session failed", "err", err)
			}

			ctx := context.WithValue(r.Context(), ctxUserKey{}, &sess.User)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ─── CSRF protection (double-submit cookie) ──────────────────────────────────

const csrfCookieName = "__kp_csrf"
const csrfHeaderName = "X-CSRF-Token"

// GenerateCSRFToken returns a random 32-byte hex string for use as a CSRF token.
func GenerateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// SetCSRFCookie sets the JS-readable CSRF cookie on the response.
func SetCSRFCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: false, // JS must be able to read this
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

// CSRFProtect validates that mutation requests (POST/PUT/DELETE) include an
// X-CSRF-Token header matching the __kp_csrf cookie value.
func CSRFProtect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Safe methods are exempt.
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie(csrfCookieName)
		if err != nil || cookie.Value == "" {
			http.Error(w, `{"error":"missing CSRF token"}`, http.StatusForbidden)
			return
		}

		header := r.Header.Get(csrfHeaderName)
		if header == "" || header != cookie.Value {
			http.Error(w, `{"error":"invalid CSRF token"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ─── Permission check ────────────────────────────────────────────────────────

// RequirePermission returns middleware that checks the authenticated user has
// the given permission. Must be placed after SessionAuth.
func RequirePermission(perm auth.Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := UserFromContext(r.Context())
			if user == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if !auth.HasPermission(user.Role, perm) {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
