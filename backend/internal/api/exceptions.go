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
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
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
		handleStoreError(w, err, ErrNotFound, "get exception failed")
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
			handleStoreError(w, err, "policy not found", "get policy failed")
			return
		}
		overlap, err := h.store.HasOverlappingException(*body.PolicyID, body.ExceptionType, body.StartsAt, body.EndsAt, 0)
		if err != nil {
			jsonInternalError(w, err, "overlap check failed")
			return
		}
		if overlap {
			jsonError(w, "time window overlaps with an existing exception of the opposite type on this policy", http.StatusConflict)
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
		handleStoreError(w, err, ErrNotFound, "get exception failed")
		return
	}
	if ex.Status != store.ExceptionStatusPending {
		jsonError(w, "only pending exceptions can be edited", http.StatusConflict)
		return
	}

	// Check for overlapping exceptions when time window or type changes.
	if ex.PolicyID != nil {
		exType := ex.ExceptionType
		if v, ok := updates["exception_type"].(string); ok {
			exType = v
		}
		startsAt := ex.StartsAt
		if v, ok := updates["starts_at"].(time.Time); ok {
			startsAt = v
		}
		endsAt := ex.EndsAt
		if v, ok := updates["ends_at"].(time.Time); ok {
			endsAt = v
		}
		overlap, err := h.store.HasOverlappingException(*ex.PolicyID, exType, startsAt, endsAt, id)
		if err != nil {
			jsonInternalError(w, err, "overlap check failed")
			return
		}
		if overlap {
			jsonError(w, "time window overlaps with an existing exception of the opposite type on this policy", http.StatusConflict)
			return
		}
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
		handleStoreError(w, err, ErrNotFound, "get exception failed")
		return
	}

	if ex.Status == store.ExceptionStatusActive && ex.SleepOnEnd != nil && *ex.SleepOnEnd && ex.PolicyID != nil && h.policyScheduler != nil {
		slog.Info("exception cancelled while active — triggering revert", "exceptionID", id, "type", ex.ExceptionType)
		if _, err := scheduler.RevertExceptionAction(h.policyScheduler, *ex.PolicyID, *ex, "exception_end"); err != nil {
			slog.Error("exception cancel: revert failed", "exceptionID", id, "type", ex.ExceptionType, "err", err)
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
		SleepOnEnd:      boolPtrDefault(body.SleepOnEnd, true),
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
	if v, ok := updates["exception_type"].(string); ok {
		if err := validateExceptionType(v); err != nil {
			return err
		}
	}
	startsAt, hasStart := updates["starts_at"].(time.Time)
	endsAt, hasEnd := updates["ends_at"].(time.Time)
	if hasStart && hasEnd && !endsAt.After(startsAt) {
		return errors.New("endsAt must be after startsAt")
	}
	if v, ok := updates["ticket_ref"].(string); ok {
		if err := validateFieldLen(v, maxTicketRefLen, "ticketRef"); err != nil {
			return err
		}
	}
	if v, ok := updates["reason"].(string); ok {
		if err := validateFieldLen(v, maxReasonLen, "reason"); err != nil {
			return err
		}
	}
	if v, ok := updates["namespace_filter"].(string); ok {
		if msg := validateNamespaceFilter(v); msg != "" {
			return errors.New(msg)
		}
	}
	return nil
}

func validateExceptionInput(b exceptionInput) error {
	if b.PolicyID == nil {
		return errors.New("policyId is required (freestanding exceptions are not yet supported)")
	}
	if err := validateExceptionType(b.ExceptionType); err != nil {
		return err
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
	if err := validateFieldLen(b.Reason, maxReasonLen, "reason"); err != nil {
		return err
	}
	if err := validateFieldLen(b.TicketRef, maxTicketRefLen, "ticketRef"); err != nil {
		return err
	}
	if msg := validateNamespaceFilter(b.NamespaceFilter); msg != "" {
		return errors.New(msg)
	}
	return nil
}

func validateExceptionType(t string) error {
	if !validExceptionTypes[t] {
		return errors.New("exceptionType must be stay_awake or force_sleep")
	}
	return nil
}

func validateFieldLen(v string, max int, name string) error {
	if len(v) > max {
		return fmt.Errorf("%s must be %d characters or fewer", name, max)
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

func boolPtrDefault(p *bool, def bool) *bool {
	if p != nil {
		return p
	}
	return &def
}

func parseIDFromString(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, err
	}
	if id == 0 {
		return 0, strconv.ErrRange
	}
	return uint(id), nil
}
