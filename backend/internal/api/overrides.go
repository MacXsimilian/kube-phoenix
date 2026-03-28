package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

func (h *Handler) listPolicyOverrides(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	overrides, err := h.store.ListPolicyOverrides(id)
	if err != nil {
		jsonInternalError(w, err, "list overrides failed")
		return
	}
	jsonOK(w, overrides)
}

func (h *Handler) createPolicyOverride(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	if _, err := h.store.GetPolicy(policyID); err != nil {
		jsonError(w, "policy not found", http.StatusNotFound)
		return
	}

	var body struct {
		OverrideType   string     `json:"overrideType"`
		StartsAt       *time.Time `json:"startsAt"`
		EndsAt         *time.Time `json:"endsAt"`
		TargetCronTime *time.Time `json:"targetCronTime"`
		Reason         string     `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}

	validTypes := map[string]bool{
		"stay_awake": true, "force_sleep": true, "skip_sleep": true, "skip_wake": true,
	}
	if len(body.Reason) > maxReasonLen {
		jsonError(w, "reason must be 1024 characters or fewer", http.StatusBadRequest)
		return
	}
	if !validTypes[body.OverrideType] {
		jsonError(w, "overrideType must be stay_awake, force_sleep, skip_sleep, or skip_wake", http.StatusBadRequest)
		return
	}

	switch body.OverrideType {
	case "stay_awake", "force_sleep":
		if body.StartsAt == nil || body.EndsAt == nil {
			jsonError(w, "startsAt and endsAt are required for windowed overrides", http.StatusBadRequest)
			return
		}
		if body.StartsAt.Before(time.Now().Add(-1 * time.Minute)) {
			jsonError(w, "startsAt must not be in the past", http.StatusBadRequest)
			return
		}
		if !body.EndsAt.After(*body.StartsAt) {
			jsonError(w, "endsAt must be after startsAt", http.StatusBadRequest)
			return
		}
	case "skip_sleep", "skip_wake":
		if body.TargetCronTime == nil {
			jsonError(w, "targetCronTime is required for skip overrides", http.StatusBadRequest)
			return
		}
	}

	createdBy := ""
	if u := authmw.UserFromContext(r.Context()); u != nil {
		createdBy = u.Username
	}

	override := &store.PolicyOverride{
		PolicyID:       policyID,
		OverrideType:   body.OverrideType,
		StartsAt:       body.StartsAt,
		EndsAt:         body.EndsAt,
		TargetCronTime: body.TargetCronTime,
		Reason:         body.Reason,
		CreatedBy:      createdBy,
	}
	if err := h.store.CreatePolicyOverride(override); err != nil {
		metrics.OverrideOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "create override failed")
		return
	}
	metrics.OverrideOperationsTotal.WithLabelValues("create", "success").Inc()
	slog.Info("policy override created", "policyID", policyID, "type", body.OverrideType)
	h.audit(r, "policy.override.create", "policy", &policyID, nil, override)

	jsonCreated(w, override)
}

func (h *Handler) deletePolicyOverride(w http.ResponseWriter, r *http.Request) {
	policyID, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	overrideID, err := parseID(r, "overrideId")
	if err != nil {
		jsonError(w, "invalid overrideId", http.StatusBadRequest)
		return
	}

	// Verify the override belongs to this policy
	existing, err := h.store.GetPolicyOverride(overrideID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, ErrNotFound, http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get override failed")
		}
		return
	}
	if existing.PolicyID != policyID {
		jsonError(w, ErrNotFound, http.StatusNotFound)
		return
	}

	if err := h.store.DeletePolicyOverride(overrideID); err != nil {
		metrics.OverrideOperationsTotal.WithLabelValues("delete", "error").Inc()
		jsonInternalError(w, err, "delete override failed")
		return
	}
	metrics.OverrideOperationsTotal.WithLabelValues("delete", "success").Inc()
	slog.Info("policy override deleted", "policyID", policyID, "overrideID", overrideID)
	h.audit(r, "policy.override.delete", "policy", &policyID, existing, nil)
	w.WriteHeader(http.StatusNoContent)
}
