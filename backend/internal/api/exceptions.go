package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"gorm.io/gorm"
)

func (h *Handler) listExceptions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.ScheduledExceptionFilter{}
	if pid := q.Get("policy_id"); pid != "" {
		id, err := parseIDFromString(pid)
		if err == nil {
			f.PolicyID = &id
		}
	}
	if s := q.Get("status"); s != "" {
		f.Status = s
	}
	items, err := h.store.ListScheduledExceptions(f)
	if err != nil {
		jsonInternalError(w, err, "list exceptions failed")
		return
	}
	// Attach deserialized workload targets
	type exceptionResponse struct {
		store.ScheduledException
		Targets []store.WorkloadTarget `json:"workloadTargets"`
	}
	resp := make([]exceptionResponse, len(items))
	for i, ex := range items {
		resp[i] = exceptionResponse{
			ScheduledException: ex,
			Targets:            ex.GetWorkloadTargets(),
		}
	}
	jsonOK(w, resp)
}

func (h *Handler) getException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, "not found", http.StatusNotFound)
		} else {
			jsonInternalError(w, err, "get exception failed")
		}
		return
	}
	jsonOK(w, exceptionWithTargets(ex))
}

func (h *Handler) createException(w http.ResponseWriter, r *http.Request) {
	var body exceptionInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if msg := validateExceptionInput(body); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	// Validate policy exists if provided
	if body.PolicyID != nil {
		if _, err := h.store.GetPolicy(*body.PolicyID); err != nil {
			jsonError(w, "policy not found", http.StatusBadRequest)
			return
		}
	}

	ex := &store.ScheduledException{
		PolicyID:        body.PolicyID,
		ExceptionType:   body.ExceptionType,
		StartsAt:        body.StartsAt,
		EndsAt:          body.EndsAt,
		TicketRef:       body.TicketRef,
		Reason:          body.Reason,
		SleepOnEnd:      body.SleepOnEnd,
		NamespaceFilter: body.NamespaceFilter,
		LabelSelector:   body.LabelSelector,
		Status:          "pending",
	}
	if !ex.SleepOnEnd && !body.SleepOnEndSet {
		ex.SleepOnEnd = true // default to true
	}

	if len(body.WorkloadTargets) > 0 {
		if err := ex.SetWorkloadTargets(body.WorkloadTargets); err != nil {
			jsonInternalError(w, err, "encode workload targets failed")
			return
		}
	}

	// Set created_by from session
	if u := authmw.UserFromContext(r.Context()); u != nil {
		ex.CreatedBy = u.Username
	}

	if err := h.store.CreateScheduledException(ex); err != nil {
		jsonInternalError(w, err, "create exception failed")
		return
	}
	slog.Info("scheduled exception created",
		"exceptionID", ex.ID, "ticketRef", ex.TicketRef, "startsAt", ex.StartsAt)
	h.audit(r, "exception.create", "exception", &ex.ID, nil, exceptionWithTargets(ex))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(exceptionWithTargets(ex))
}

func (h *Handler) updateException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	if ex.Status != "pending" {
		jsonError(w, "only pending exceptions can be edited", http.StatusConflict)
		return
	}

	var body exceptionInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

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
	if body.SleepOnEndSet {
		updates["sleep_on_end"] = body.SleepOnEnd
	}
	if body.NamespaceFilter != "" {
		updates["namespace_filter"] = body.NamespaceFilter
	}
	if body.LabelSelector != "" {
		updates["label_selector"] = body.LabelSelector
	}
	if len(body.WorkloadTargets) > 0 {
		b, err := json.Marshal(body.WorkloadTargets)
		if err == nil {
			updates["workload_targets"] = string(b)
		}
	}

	updated, err := h.store.UpdateScheduledException(id, updates)
	if err != nil {
		jsonInternalError(w, err, "update exception failed")
		return
	}
	h.audit(r, "exception.update", "exception", &id, exceptionWithTargets(ex), exceptionWithTargets(updated))
	jsonOK(w, exceptionWithTargets(updated))
}

func (h *Handler) deleteException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	// If active, trigger sleep-on-end before cancelling
	if ex.Status == "active" && ex.SleepOnEnd && ex.PolicyID != nil {
		slog.Info("exception cancelled while active — triggering sleep-on-end", "exceptionID", id)
		if _, runErr := h.policyScheduler.RunSleepNow(*ex.PolicyID, "exception_end"); runErr != nil {
			slog.Error("exception cancel: sleep-on-end failed", "exceptionID", id, "err", runErr)
		}
	}

	updates := map[string]interface{}{
		"status":        "cancelled",
		"cancel_reason": "deleted via API",
	}
	if _, err := h.store.UpdateScheduledException(id, updates); err != nil {
		jsonInternalError(w, err, "cancel exception failed")
		return
	}
	slog.Info("scheduled exception cancelled", "exceptionID", id)
	h.audit(r, "exception.delete", "exception", &id, exceptionWithTargets(ex), nil)
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
	SleepOnEnd      bool                   `json:"sleepOnEnd"`
	SleepOnEndSet   bool                   `json:"-"` // tracks if field was explicitly provided
	NamespaceFilter string                 `json:"namespaceFilter"`
	LabelSelector   string                 `json:"labelSelector"`
	WorkloadTargets []store.WorkloadTarget `json:"workloadTargets"`
}

func (e *exceptionInput) UnmarshalJSON(data []byte) error {
	type Alias exceptionInput
	raw := struct {
		Alias
		SleepOnEnd *bool `json:"sleepOnEnd"`
	}{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*e = exceptionInput(raw.Alias)
	if raw.SleepOnEnd != nil {
		e.SleepOnEnd = *raw.SleepOnEnd
		e.SleepOnEndSet = true
	}
	return nil
}

func validateExceptionInput(b exceptionInput) string {
	if b.ExceptionType != "stay_awake" && b.ExceptionType != "force_sleep" {
		return "exceptionType must be stay_awake or force_sleep"
	}
	if b.StartsAt.IsZero() {
		return "startsAt is required"
	}
	if b.EndsAt.IsZero() {
		return "endsAt is required"
	}
	if !b.EndsAt.After(b.StartsAt) {
		return "endsAt must be after startsAt"
	}
	if time.Until(b.StartsAt) < 0 {
		return "startsAt must be in the future"
	}
	return ""
}

type exceptionResponseShape struct {
	store.ScheduledException
	Targets []store.WorkloadTarget `json:"workloadTargets"`
}

func exceptionWithTargets(ex *store.ScheduledException) exceptionResponseShape {
	return exceptionResponseShape{
		ScheduledException: *ex,
		Targets:            ex.GetWorkloadTargets(),
	}
}

// parseIDFromString parses a uint from a string query parameter.
func parseIDFromString(s string) (uint, error) {
	var id uint64
	_, err := parseUintBase(s, 10, 64, &id)
	return uint(id), err
}

func parseUintBase(s string, base, bits int, dst *uint64) (int, error) {
	n := uint64(0)
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, &numError{s}
		}
		d := uint64(c-'0') //#nosec G115 -- c is '0'..'9', subtraction cannot overflow
		n = n*uint64(base) + d //#nosec G115 -- base is always 10 in callers
	}
	*dst = n
	return len(s), nil
}

type numError struct{ s string }

func (e *numError) Error() string { return "invalid number: " + e.s }
