package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

// ─── List users ──────────────────────────────────────────────────────────────

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers()
	if err != nil {
		jsonInternalError(w, err, "list users failed")
		return
	}
	jsonOK(w, users)
}

// ─── Create user ─────────────────────────────────────────────────────────────

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}
	if body.Username == "" || body.Password == "" {
		jsonError(w, "username and password are required", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 8 {
		jsonError(w, "password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if body.Role == "" {
		body.Role = "viewer"
	}
	if !auth.ValidRole(body.Role) {
		jsonError(w, "role must be admin, operator, or viewer", http.StatusBadRequest)
		return
	}

	hash, err := store.HashPassword(body.Password)
	if err != nil {
		jsonInternalError(w, err, "hash password failed")
		return
	}

	user := &store.User{
		Username:     body.Username,
		Email:        body.Email,
		PasswordHash: hash,
		Role:         body.Role,
		Source:       "local",
		Enabled:      true,
	}
	if err := h.store.CreateUser(user); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateKeyError(err) {
			jsonError(w, "username already exists", http.StatusConflict)
			return
		}
		jsonInternalError(w, err, "create user failed")
		return
	}

	h.audit(r, "user.create", "user", &user.ID, nil, map[string]interface{}{"username": user.Username, "role": user.Role})
	jsonCreated(w, user)
}

// ─── Update user ─────────────────────────────────────────────────────────────

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}

	target, err := h.store.GetUserByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "user not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get user failed")
		}
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}

	caller := authmw.UserFromContext(r.Context())
	if msg, code := sanitizeUserUpdate(body, target, caller, id); msg != "" {
		jsonError(w, msg, code)
		return
	}

	updated, err := h.store.UpdateUser(id, body)
	if err != nil {
		jsonInternalError(w, err, "update user failed")
		return
	}
	h.audit(r, "user.update", "user", &id, target, updated)

	// If the user was disabled, revoke all their sessions.
	if enabled, ok := body["enabled"].(bool); ok && !enabled {
		_ = h.store.DeleteUserSessions(id)
	}

	jsonOK(w, updated)
}

// sanitizeUserUpdate enforces role/self-modification rules and strips non-editable
// fields from body. Returns an error message and HTTP status, or "" if valid.
func sanitizeUserUpdate(body map[string]interface{}, target *store.User, caller *store.User, id uint) (string, int) {
	// OIDC users: role is managed by AD groups, not editable here.
	if target.Source == "oidc" {
		delete(body, "role")
	}

	if role, ok := body["role"].(string); ok && !auth.ValidRole(role) {
		return "role must be admin, operator, or viewer", http.StatusBadRequest
	}

	if caller != nil && caller.ID == id {
		if role, ok := body["role"].(string); ok && role != caller.Role {
			return "cannot change your own role", http.StatusBadRequest
		}
		if enabled, ok := body["enabled"].(bool); ok && !enabled {
			return "cannot disable your own account", http.StatusBadRequest
		}
	}

	return "", 0
}

// ─── Delete user ─────────────────────────────────────────────────────────────

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}

	caller := authmw.UserFromContext(r.Context())
	if caller != nil && caller.ID == id {
		jsonError(w, "cannot delete your own account", http.StatusBadRequest)
		return
	}

	target, _ := h.store.GetUserByID(id)
	if err := h.store.DeleteUser(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "user not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "delete user failed")
		}
		return
	}
	h.audit(r, "user.delete", "user", &id, target, nil)
	w.WriteHeader(http.StatusNoContent)
}

// isDuplicateKeyError checks for PostgreSQL unique constraint violations.
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "UNIQUE constraint")
}
