// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	authmw "github.com/macxsimilian/kube-phoenix/backend/internal/middleware"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"gorm.io/gorm"
)

// Conflict resolutions accepted on the apply endpoint.
const (
	resolveSkip      = "skip"
	resolveOverwrite = "overwrite"
	resolveRename    = "rename"
)

// importStatus values describe how a payload would land relative to existing data.
const (
	statusCreate    = "create"
	statusConflict  = "conflict"
	statusSkipped   = "skipped"
	statusOverwrote = "overwritten"
	statusRenamed   = "renamed"
)

// ─── Guardrails ──────────────────────────────────────────────────────────────

type guardrailsImportRequest struct {
	guardrailsExport
	Resolution string `json:"conflictResolution,omitempty"`
}

type guardrailsImportPreview struct {
	Status     string                `json:"status"` // always "conflict" — guardrails is a singleton
	Before     *guardrailsExportBody `json:"before"`
	After      guardrailsExportBody  `json:"after"`
	Differs    bool                  `json:"differs"`
	Validation string                `json:"validationError,omitempty"`
}

func (h *Handler) previewGuardrailsImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodeGuardrailsImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	preview, msg := h.buildGuardrailsPreview(req.Guardrails)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	jsonOK(w, preview)
}

func (h *Handler) applyGuardrailsImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodeGuardrailsImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if msg := validateGuardrailsImport(req.Guardrails); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	resolution := req.Resolution
	if resolution == "" {
		resolution = resolveOverwrite
	}
	if resolution != resolveOverwrite && resolution != resolveSkip {
		jsonError(w, "conflictResolution must be 'overwrite' or 'skip' for guardrails", http.StatusBadRequest)
		return
	}

	old, err := h.store.GetGuardrails()
	if err != nil {
		jsonInternalError(w, err, "get existing guardrails failed")
		return
	}

	if resolution == resolveSkip {
		h.audit(r, "guardrail.import", "guardrail", nil, old, map[string]string{"resolution": resolveSkip})
		jsonOK(w, map[string]string{"status": statusSkipped})
		return
	}

	updates := guardrailsBodyToUpdates(req.Guardrails)
	updated, err := h.store.UpdateGuardrails(updates)
	if err != nil {
		jsonInternalError(w, err, "apply guardrails import failed")
		return
	}
	h.audit(r, "guardrail.import", "guardrail", nil, old, updated)
	h.applySchedulerSettings(updated)
	jsonOK(w, map[string]any{"status": statusOverwrote, "guardrails": updated})
}

// ─── Policy ──────────────────────────────────────────────────────────────────

type policyImportRequest struct {
	policyExport
	Resolution string `json:"conflictResolution,omitempty"`
	NewName    string `json:"newName,omitempty"`
}

type policyImportPreview struct {
	Status           string            `json:"status"` // "create" or "conflict"
	ExistingPolicy   *policyExportBody `json:"existingPolicy,omitempty"`
	Incoming         policyExportBody  `json:"incoming"`
	ForcedEnabledOff bool              `json:"forcedEnabledOff"`
	ForcedModeToPlan bool              `json:"forcedModeToPlan"`
	ConflictByName   string            `json:"conflictByName,omitempty"`
	ValidationError  string            `json:"validationError,omitempty"`
}

func (h *Handler) previewPolicyImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodePolicyImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	preview, msg := h.buildPolicyPreview(req.Policy)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	jsonOK(w, preview)
}

func (h *Handler) applyPolicyImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodePolicyImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if msg := validatePolicyImport(req.Policy); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	existing, err := h.store.GetPolicyByName(req.Policy.Name)
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		h.applyPolicyCreate(w, r, req.Policy)
	case err != nil:
		jsonInternalError(w, err, "lookup existing policy by name failed")
	default:
		h.applyPolicyConflict(w, r, req, existing)
	}
}

func (h *Handler) applyPolicyCreate(w http.ResponseWriter, r *http.Request, body policyExportBody) {
	p, msg := preparePolicyForImport(body, "")
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if err := h.store.CreatePolicy(&p); err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "create policy from import failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("create", "success").Inc()
	h.audit(r, "policy.import", "policy", &p.ID, nil, policyAuditSnapshot(p))
	h.reloadScheduler(p.ID)
	jsonCreated(w, map[string]any{"status": statusCreate, "policy": h.policyResp(p)})
}

func (h *Handler) applyPolicyConflict(w http.ResponseWriter, r *http.Request, req policyImportRequest, existing *store.Policy) {
	switch req.Resolution {
	case resolveSkip:
		h.audit(r, "policy.import", "policy", &existing.ID, existing, map[string]string{"resolution": resolveSkip})
		jsonOK(w, map[string]any{"status": statusSkipped, "existingId": existing.ID})
	case resolveOverwrite:
		h.overwritePolicy(w, r, req.Policy, existing)
	case resolveRename:
		h.renamePolicyImport(w, r, req)
	default:
		jsonError(w, "conflictResolution must be 'skip', 'overwrite', or 'rename' for policy", http.StatusBadRequest)
	}
}

func (h *Handler) overwritePolicy(w http.ResponseWriter, r *http.Request, body policyExportBody, existing *store.Policy) {
	updates, msg := policyBodyToUpdates(body)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	updated, err := h.store.UpdatePolicy(existing.ID, updates)
	if err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("update", "error").Inc()
		jsonInternalError(w, err, "overwrite policy import failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("update", "success").Inc()
	h.audit(r, "policy.import", "policy", &existing.ID, existing, updated)
	h.reloadScheduler(existing.ID)
	jsonOK(w, map[string]any{"status": statusOverwrote, "policy": h.policyResp(*updated)})
}

func (h *Handler) renamePolicyImport(w http.ResponseWriter, r *http.Request, req policyImportRequest) {
	if req.NewName == "" {
		jsonError(w, "newName is required when conflictResolution is 'rename'", http.StatusBadRequest)
		return
	}
	if _, err := h.store.GetPolicyByName(req.NewName); !errors.Is(err, gorm.ErrRecordNotFound) {
		if err == nil {
			jsonError(w, "newName already exists; pick a different name", http.StatusConflict)
		} else {
			jsonInternalError(w, err, "lookup newName collision failed")
		}
		return
	}
	p, msg := preparePolicyForImport(req.Policy, req.NewName)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if err := h.store.CreatePolicy(&p); err != nil {
		metrics.PolicyOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "rename-import policy failed")
		return
	}
	metrics.PolicyOperationsTotal.WithLabelValues("create", "success").Inc()
	h.audit(r, "policy.import", "policy", &p.ID, nil, policyAuditSnapshot(p))
	h.reloadScheduler(p.ID)
	jsonCreated(w, map[string]any{"status": statusRenamed, "policy": h.policyResp(p)})
}

// ─── Exception ───────────────────────────────────────────────────────────────

type exceptionImportRequest struct {
	exceptionExport
}

type exceptionImportPreview struct {
	Status           string              `json:"status"` // "create" or carries an error
	ParentPolicyID   *uint               `json:"parentPolicyId,omitempty"`
	ParentPolicyName *string             `json:"parentPolicyName,omitempty"`
	Incoming         exceptionExportBody `json:"incoming"`
	ValidationError  string              `json:"validationError,omitempty"`
}

func (h *Handler) previewExceptionImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodeExceptionImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	preview, status, msg := h.buildExceptionPreview(req.Exception)
	if msg != "" {
		jsonError(w, msg, status)
		return
	}
	jsonOK(w, preview)
}

func (h *Handler) applyExceptionImport(w http.ResponseWriter, r *http.Request) {
	req, msg := decodeExceptionImport(r)
	if msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	if msg, status := validateExceptionImport(req.Exception); msg != "" {
		jsonError(w, msg, status)
		return
	}

	policyID, msg, status := h.resolveExceptionParent(req.Exception.PolicyName)
	if msg != "" {
		jsonError(w, msg, status)
		return
	}

	if msg, status := h.checkImportedExceptionOverlap(policyID, req.Exception); msg != "" {
		jsonError(w, msg, status)
		return
	}

	ex, err := newExceptionFromImport(req.Exception, policyID, r)
	if err != nil {
		jsonInternalError(w, err, "build imported exception failed")
		return
	}
	if err := h.store.CreateScheduledException(ex); err != nil {
		metrics.ExceptionOperationsTotal.WithLabelValues("create", "error").Inc()
		jsonInternalError(w, err, "create imported exception failed")
		return
	}
	metrics.ExceptionOperationsTotal.WithLabelValues("create", "success").Inc()
	shape, err := exceptionWithTargets(ex)
	if err != nil {
		jsonInternalError(w, err, "decode exception targets failed")
		return
	}
	h.audit(r, "exception.import", "exception", &ex.ID, nil, shape)
	jsonCreated(w, map[string]any{"status": statusCreate, "exception": shape})
}

func newExceptionFromImport(body exceptionExportBody, policyID *uint, r *http.Request) (*store.ScheduledException, error) {
	ex := &store.ScheduledException{
		PolicyID:        policyID,
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
			return nil, err
		}
	}
	if u := authmw.UserFromContext(r.Context()); u != nil {
		ex.CreatedBy = u.Username
	}
	return ex, nil
}

// ─── Preview builders ────────────────────────────────────────────────────────

func (h *Handler) buildGuardrailsPreview(body guardrailsExportBody) (guardrailsImportPreview, string) {
	if msg := validateGuardrailsImport(body); msg != "" {
		return guardrailsImportPreview{}, msg
	}
	existing, err := h.store.GetGuardrails()
	if err != nil {
		return guardrailsImportPreview{}, "could not read existing guardrails"
	}
	beforeBody := guardrailsModelToBody(existing)
	return guardrailsImportPreview{
		Status:  statusConflict,
		Before:  &beforeBody,
		After:   body,
		Differs: beforeBody != body,
	}, ""
}

func (h *Handler) buildPolicyPreview(body policyExportBody) (policyImportPreview, string) {
	if msg := validatePolicyImport(body); msg != "" {
		return policyImportPreview{
			Status:          statusCreate,
			Incoming:        body,
			ValidationError: msg,
		}, msg
	}
	existing, err := h.store.GetPolicyByName(body.Name)
	preview := policyImportPreview{
		Status:           statusCreate,
		Incoming:         body,
		ForcedEnabledOff: body.Enabled,
		ForcedModeToPlan: body.Mode != "" && body.Mode != store.PolicyModePlan,
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return preview, ""
	}
	if err != nil {
		return preview, "lookup existing policy by name failed"
	}
	existingBody := policyModelToBody(existing)
	preview.Status = statusConflict
	preview.ExistingPolicy = &existingBody
	preview.ConflictByName = body.Name
	return preview, ""
}

func (h *Handler) buildExceptionPreview(body exceptionExportBody) (exceptionImportPreview, int, string) {
	if msg, status := validateExceptionImport(body); msg != "" {
		return exceptionImportPreview{Incoming: body, ValidationError: msg}, status, msg
	}
	policyID, msg, status := h.resolveExceptionParent(body.PolicyName)
	if msg != "" {
		return exceptionImportPreview{Incoming: body, ValidationError: msg}, status, msg
	}
	if msg, status := h.checkImportedExceptionOverlap(policyID, body); msg != "" {
		return exceptionImportPreview{Incoming: body, ValidationError: msg}, status, msg
	}
	preview := exceptionImportPreview{
		Status:           statusCreate,
		Incoming:         body,
		ParentPolicyID:   policyID,
		ParentPolicyName: body.PolicyName,
	}
	return preview, http.StatusOK, ""
}

// checkImportedExceptionOverlap mirrors the create-path overlap guard from
// exceptions.go: an exception cannot land on top of an existing opposite-type
// window on the same policy. Freestanding exceptions (policyID == nil) are not
// checked because the overlap query is scoped to a policy.
func (h *Handler) checkImportedExceptionOverlap(policyID *uint, body exceptionExportBody) (string, int) {
	if policyID == nil {
		return "", http.StatusOK
	}
	overlap, err := h.store.HasOverlappingException(*policyID, body.ExceptionType, body.StartsAt, body.EndsAt, 0)
	if err != nil {
		return "overlap check failed", http.StatusInternalServerError
	}
	if overlap {
		return "time window overlaps with an existing exception of the opposite type on this policy", http.StatusConflict
	}
	return "", http.StatusOK
}

// resolveExceptionParent looks up a policy by name or returns nil for a freestanding
// exception. Returns (id, errorMessage, httpStatus).
func (h *Handler) resolveExceptionParent(name *string) (*uint, string, int) {
	if name == nil || *name == "" {
		return nil, "", http.StatusOK
	}
	p, err := h.store.GetPolicyByName(*name)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "Parent policy '" + *name + "' not found in target environment. Import the policy first, then retry.", http.StatusUnprocessableEntity
	}
	if err != nil {
		return nil, "lookup parent policy failed", http.StatusInternalServerError
	}
	return &p.ID, "", http.StatusOK
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (h *Handler) applySchedulerSettings(g *store.Guardrails) {
	if h.policyScheduler == nil {
		return
	}
	if err := h.policyScheduler.UpdateSettings(scheduler.SchedulerConfig{
		TickInterval:        g.ParseSchedulerEvalInterval(),
		AutoWake:            g.SchedulerAutoWake,
		ReconcileWhileAwake: g.SchedulerReconcileWhileAwake,
		EnforceSleep:        g.SchedulerEnforceSleep,
	}); err != nil {
		slog.Error("scheduler settings update failed", "err", err)
	}
}

// guardrailsBodyToUpdates converts an import body into the snake_case update
// map expected by store.UpdateGuardrails.
func guardrailsBodyToUpdates(b guardrailsExportBody) map[string]interface{} {
	return map[string]interface{}{
		"protected_namespaces":            b.ProtectedNamespaces,
		"skip_ns_node":                    b.SkipNsNode,
		"skip_node_labels":                b.SkipNodeLabels,
		"skip_node_taints":                b.SkipNodeTaints,
		"scaling_priority_namespaces":     b.ScalingPriorityNamespaces,
		"scheduler_eval_interval":         b.SchedulerEvalInterval,
		"scheduler_auto_wake":             b.SchedulerAutoWake,
		"scheduler_reconcile_while_awake": b.SchedulerReconcileWhileAwake,
		"scheduler_enforce_sleep":         b.SchedulerEnforceSleep,
		"scaling_concurrency":             b.ScalingConcurrency,
		"wake_wave_size":                  b.WakeWaveSize,
		"wake_wave_pause_seconds":         b.WakeWavePauseSeconds,
		"protect_critical_pod_nodes":      b.ProtectCriticalPodNodes,
	}
}

func guardrailsModelToBody(g *store.Guardrails) guardrailsExportBody {
	return guardrailsExportBody{
		ProtectedNamespaces:          g.ProtectedNamespaces,
		SkipNsNode:                   g.SkipNsNode,
		SkipNodeLabels:               g.SkipNodeLabels,
		SkipNodeTaints:               g.SkipNodeTaints,
		ScalingPriorityNamespaces:    g.ScalingPriorityNamespaces,
		SchedulerEvalInterval:        g.SchedulerEvalInterval,
		SchedulerAutoWake:            g.SchedulerAutoWake,
		SchedulerReconcileWhileAwake: g.SchedulerReconcileWhileAwake,
		SchedulerEnforceSleep:        g.SchedulerEnforceSleep,
		ScalingConcurrency:           g.ScalingConcurrency,
		WakeWaveSize:                 g.WakeWaveSize,
		WakeWavePauseSeconds:         g.WakeWavePauseSeconds,
		ProtectCriticalPodNodes:      g.ProtectCriticalPodNodes,
	}
}

func policyModelToBody(p *store.Policy) policyExportBody {
	return policyExportBody{
		Name:            p.Name,
		Description:     p.Description,
		NamespaceFilter: p.NamespaceFilter,
		LabelSelector:   p.LabelSelector,
		Timezone:        p.Timezone,
		Mode:            p.Mode,
		Enabled:         p.Enabled,
		TimeoutMinutes:  p.TimeoutMinutes,
		SleepWindows:    parseSleepWindows(*p),
	}
}

// preparePolicyForImport converts an import body into a store.Policy with the
// safety overrides applied (enabled=false, mode="plan"). Reuses
// validateAndPreparePolicy to set Timezone/initial state defaults.
func preparePolicyForImport(body policyExportBody, overrideName string) (store.Policy, string) {
	name := body.Name
	if overrideName != "" {
		name = overrideName
	}
	input := createPolicyInput{
		Policy: store.Policy{
			Name:            name,
			Description:     body.Description,
			NamespaceFilter: body.NamespaceFilter,
			LabelSelector:   body.LabelSelector,
			Timezone:        body.Timezone,
			Mode:            store.PolicyModePlan,
			Enabled:         false,
			TimeoutMinutes:  body.TimeoutMinutes,
		},
		SleepWindows: body.SleepWindows,
	}
	return validateAndPreparePolicy(input)
}

// policyBodyToUpdates produces the GORM update map for overwrite-on-import.
// Forces enabled=false and mode="plan" per the locked design.
func policyBodyToUpdates(body policyExportBody) (map[string]interface{}, string) {
	windowsJSON, err := json.Marshal(body.SleepWindows)
	if err != nil {
		return nil, "failed to marshal sleep windows"
	}
	updates := map[string]interface{}{
		"name":             body.Name,
		"description":      body.Description,
		"namespace_filter": body.NamespaceFilter,
		"label_selector":   body.LabelSelector,
		"timezone":         body.Timezone,
		"mode":             store.PolicyModePlan,
		"enabled":          false,
		"timeout_minutes":  body.TimeoutMinutes,
		"sleep_windows":    string(windowsJSON),
	}
	if msg := validatePolicyUpdates(updates); msg != "" {
		return nil, msg
	}
	return updates, ""
}
