package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

func (h *Handler) listExceptions(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	filter := store.ScheduledExceptionFilter{}
	if pid := query.Get("policy_id"); pid != "" {
		id, err := parseIDFromString(pid)
		if err == nil {
			filter.PolicyID = &id
		}
	}
	if s := query.Get("status"); s != "" {
		if !validExceptionStatuses[s] {
			jsonError(w, "status must be pending, active, completed, or cancelled", http.StatusBadRequest)
			return
		}
		filter.Status = s
	}
	items, err := h.store.ListScheduledExceptions(filter)
	if err != nil {
		jsonInternalError(w, err, "list exceptions failed")
		return
	}
	resp := make([]exceptionResponseShape, len(items))
	for i := range items {
		shape, err := exceptionWithTargets(&items[i])
		if err != nil {
			jsonInternalError(w, err, "decode exception targets failed")
			return
		}
		resp[i] = shape
	}
	jsonOK(w, resp)
}

func (h *Handler) getException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, ErrNotFound, http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get exception failed")
		}
		return
	}
	shape, err := exceptionWithTargets(ex)
	if err != nil {
		jsonInternalError(w, err, "decode exception targets failed")
		return
	}
	jsonOK(w, shape)
}

func (h *Handler) createException(w http.ResponseWriter, r *http.Request) {
	var body exceptionInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}
	if err := validateExceptionInput(body); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.PolicyID != nil {
		if _, err := h.store.GetPolicy(*body.PolicyID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				jsonError(w, "policy not found", http.StatusBadRequest)
			} else {
				jsonInternalError(w, err, "get policy failed")
			}
			return
		}
	}

	ex, err := newExceptionFromInput(body, r)
	if err != nil {
		jsonInternalError(w, err, "build exception failed")
		return
	}

	if err := h.store.CreateScheduledException(ex); err != nil {
		metrics.ExceptionOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "create exception failed")
		return
	}
	metrics.ExceptionOperationsTotal.WithLabelValues("create", "success").Inc()
	slog.Info("scheduled exception created",
		"exceptionID", ex.ID, "ticketRef", ex.TicketRef, "startsAt", ex.StartsAt)
	shape, err := exceptionWithTargets(ex)
	if err != nil {
		jsonInternalError(w, err, "decode exception targets failed")
		return
	}
	h.audit(r, "exception.create", "exception", &ex.ID, nil, shape)
	jsonCreated(w, shape)
}

func (h *Handler) updateException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}

	var body exceptionInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, ErrInvalidBody, http.StatusBadRequest)
		return
	}
	updates, err := buildExceptionUpdates(body)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, ErrNotFound, http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get exception failed")
		}
		return
	}
	if ex.Status != store.ExceptionStatusPending {
		jsonError(w, "only pending exceptions can be edited", http.StatusConflict)
		return
	}

	updated, err := h.store.UpdateScheduledException(id, updates)
	if err != nil {
		metrics.ExceptionOperationsTotal.WithLabelValues("update", "error").Inc()
		jsonInternalError(w, err, "update exception failed")
		return
	}
	metrics.ExceptionOperationsTotal.WithLabelValues("update", "success").Inc()
	oldShape, err := exceptionWithTargets(ex)
	if err != nil {
		jsonInternalError(w, err, "decode exception targets failed")
		return
	}
	newShape, err := exceptionWithTargets(updated)
	if err != nil {
		jsonInternalError(w, err, "decode exception targets failed")
		return
	}
	h.audit(r, "exception.update", "exception", &id, oldShape, newShape)
	jsonOK(w, newShape)
}

func (h *Handler) deleteException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, ErrNotFound, http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get exception failed")
		}
		return
	}

	if ex.Status == store.ExceptionStatusActive && ex.SleepOnEnd && ex.PolicyID != nil && h.policyScheduler != nil {
		slog.Info("exception cancelled while active — triggering sleep-on-end", "exceptionID", id)
		if _, runErr := h.policyScheduler.RunSleepNow(*ex.PolicyID, "exception_end"); runErr != nil {
			slog.Error("exception cancel: sleep-on-end failed", "exceptionID", id, "err", runErr)
		}
	}

	if err := h.store.CancelScheduledException(id, "deleted via API"); err != nil {
		metrics.ExceptionOperationsTotal.WithLabelValues("delete", "error").Inc()
		jsonInternalError(w, err, "cancel exception failed")
		return
	}
	metrics.ExceptionOperationsTotal.WithLabelValues("delete", "success").Inc()
	slog.Info("scheduled exception cancelled", "exceptionID", id)
	delShape, err := exceptionWithTargets(ex)
	if err != nil {
		slog.Warn("could not decode exception targets for audit", "exceptionID", id, "err", err)
	}
	h.audit(r, "exception.delete", "exception", &id, delShape, nil)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Input / helpers ──────────────────────────────────────────────────────────

type exceptionInput struct {
	PolicyID        *uint                  `json:"policyId"`
	ExceptionType   string                 `json:"exceptionType"`
	StartsAt        time.Time              `json:"startsAt"`
	EndsAt          time.Time              `json:"endsAt"`
	TicketRef       string                 `json:"ticketRef"`
	Reason          string                 `json:"reason"`
	SleepOnEnd      *bool                  `json:"sleepOnEnd"`
	NamespaceFilter string                 `json:"namespaceFilter"`
	LabelSelector   string                 `json:"labelSelector"`
	WorkloadTargets []store.WorkloadTarget `json:"workloadTargets"`
}

func newExceptionFromInput(body exceptionInput, r *http.Request) (*store.ScheduledException, error) {
	ex := &store.ScheduledException{
		PolicyID:        body.PolicyID,
		ExceptionType:   body.ExceptionType,
		StartsAt:        body.StartsAt,
		EndsAt:          body.EndsAt,
		TicketRef:       body.TicketRef,
		Reason:          body.Reason,
		SleepOnEnd:      body.SleepOnEnd == nil || *body.SleepOnEnd, // default true
		NamespaceFilter: body.NamespaceFilter,
		LabelSelector:   body.LabelSelector,
		Status:          store.ExceptionStatusPending,
	}
	if len(body.WorkloadTargets) > 0 {
		if err := ex.SetWorkloadTargets(body.WorkloadTargets); err != nil {
			return nil, fmt.Errorf("encode workload targets: %w", err)
		}
	}
	if u := authmw.UserFromContext(r.Context()); u != nil {
		ex.CreatedBy = u.Username
	}
	return ex, nil
}

func buildExceptionUpdates(body exceptionInput) (map[string]interface{}, error) {
	updates := map[string]interface{}{}
	if body.ExceptionType != "" {
		updates["exception_type"] = body.ExceptionType
	}
	if !body.StartsAt.IsZero() {
		updates["starts_at"] = body.StartsAt
	}
	if !body.EndsAt.IsZero() {
		updates["ends_at"] = body.EndsAt
	}
	if body.TicketRef != "" {
		updates["ticket_ref"] = body.TicketRef
	}
	if body.Reason != "" {
		updates["reason"] = body.Reason
	}
	if body.SleepOnEnd != nil {
		updates["sleep_on_end"] = *body.SleepOnEnd
	}
	if body.NamespaceFilter != "" {
		updates["namespace_filter"] = body.NamespaceFilter
	}
	if body.LabelSelector != "" {
		updates["label_selector"] = body.LabelSelector
	}
	if len(body.WorkloadTargets) > 0 {
		b, err := json.Marshal(body.WorkloadTargets)
		if err != nil {
			return nil, fmt.Errorf("encode workload targets: %w", err)
		}
		updates["workload_targets"] = string(b)
	}
	if err := validateExceptionUpdates(updates); err != nil {
		return nil, err
	}
	return updates, nil
}

func validateExceptionUpdates(updates map[string]interface{}) error {
	if v, ok := updates["exception_type"].(string); ok && !validExceptionTypes[v] {
		return errors.New("exceptionType must be stay_awake or force_sleep")
	}
	startsAt, hasStart := updates["starts_at"].(time.Time)
	endsAt, hasEnd := updates["ends_at"].(time.Time)
	if hasStart && hasEnd && !endsAt.After(startsAt) {
		return errors.New("endsAt must be after startsAt")
	}
	if v, ok := updates["ticket_ref"].(string); ok && len(v) > maxTicketRefLen {
		return errors.New("ticketRef must be 255 characters or fewer")
	}
	if v, ok := updates["reason"].(string); ok && len(v) > maxReasonLen {
		return errors.New("reason must be 1024 characters or fewer")
	}
	return nil
}

func validateExceptionInput(b exceptionInput) error {
	if !validExceptionTypes[b.ExceptionType] {
		return errors.New("exceptionType must be stay_awake or force_sleep")
	}
	if b.StartsAt.IsZero() {
		return errors.New("startsAt is required")
	}
	if b.EndsAt.IsZero() {
		return errors.New("endsAt is required")
	}
	if !b.EndsAt.After(b.StartsAt) {
		return errors.New("endsAt must be after startsAt")
	}
	if time.Until(b.StartsAt) < 0 {
		return errors.New("startsAt must be in the future")
	}
	if len(b.Reason) > maxReasonLen {
		return errors.New("reason must be 1024 characters or fewer")
	}
	if len(b.TicketRef) > maxTicketRefLen {
		return errors.New("ticketRef must be 255 characters or fewer")
	}
	return nil
}

type exceptionResponseShape struct {
	store.ScheduledException
	Targets []store.WorkloadTarget `json:"workloadTargets"`
}

func exceptionWithTargets(ex *store.ScheduledException) (exceptionResponseShape, error) {
	targets, err := ex.GetWorkloadTargets()
	if err != nil {
		return exceptionResponseShape{}, err
	}
	return exceptionResponseShape{
		ScheduledException: *ex,
		Targets:            targets,
	}, nil
}

func parseIDFromString(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 64)
	return uint(id), err
}
