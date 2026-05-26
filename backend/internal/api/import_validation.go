// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
)

// ─── Decoders ────────────────────────────────────────────────────────────────

func decodeGuardrailsImport(r *http.Request) (guardrailsImportRequest, string) {
	var req guardrailsImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, ErrInvalidBody
	}
	if msg := validateEnvelope(req.SchemaVersion, req.Kind, exportKindGuardrails); msg != "" {
		return req, msg
	}
	return req, ""
}

func decodePolicyImport(r *http.Request) (policyImportRequest, string) {
	var req policyImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, ErrInvalidBody
	}
	if msg := validateEnvelope(req.SchemaVersion, req.Kind, exportKindPolicy); msg != "" {
		return req, msg
	}
	return req, ""
}

func decodeExceptionImport(r *http.Request) (exceptionImportRequest, string) {
	var req exceptionImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, ErrInvalidBody
	}
	if msg := validateEnvelope(req.SchemaVersion, req.Kind, exportKindException); msg != "" {
		return req, msg
	}
	return req, ""
}

// validateEnvelope checks schemaVersion and kind match the endpoint.
func validateEnvelope(version int, kind, expectedKind string) string {
	if version != exportSchemaVersion {
		return fmt.Sprintf("schemaVersion %d is not supported; expected %d", version, exportSchemaVersion)
	}
	if kind != expectedKind {
		return fmt.Sprintf("kind %q does not match endpoint (expected %q)", kind, expectedKind)
	}
	return ""
}

// ─── Validators ──────────────────────────────────────────────────────────────

func validateGuardrailsImport(b guardrailsExportBody) string {
	body := map[string]interface{}{
		"systemNamespaces":          b.SystemNamespaces,
		"skipNsNode":                b.SkipNsNode,
		"skipNodeLabels":            b.SkipNodeLabels,
		"skipNodeTaints":            b.SkipNodeTaints,
		"scalingPriorityNamespaces": b.ScalingPriorityNamespaces,
		"schedulerEvalInterval":     b.SchedulerEvalInterval,
		"scalingConcurrency":        float64(b.ScalingConcurrency),
		"wakeWaveSize":              float64(b.WakeWaveSize),
		"wakeWavePauseSeconds":      float64(b.WakeWavePauseSeconds),
	}
	return validateGuardrailFields(body)
}

func validatePolicyImport(b policyExportBody) string {
	if b.Name == "" {
		return "name is required"
	}
	if len(b.SleepWindows) == 0 {
		return "sleepWindows is required"
	}
	if err := policy.ValidateWindows(b.SleepWindows); err != nil {
		return err.Error()
	}
	return validatePolicyImportFields(b)
}

func validatePolicyImportFields(b policyExportBody) string {
	for _, msg := range []string{
		validatePolicyName(b.Name),
		validatePolicyDescription(b.Description),
		validatePolicyLabelSelector(b.LabelSelector),
		validatePolicyTimeout(b.TimeoutMinutes),
		validatePolicyTimezone(b.Timezone),
		validateNamespaceFilter(b.NamespaceFilter),
	} {
		if msg != "" {
			return msg
		}
	}
	return ""
}

// validateExceptionImport returns (errorMessage, httpStatus). The status is 400
// for malformed input and 422 when the time window is in the past — these are
// reachable when an exception JSON is shared after its startsAt.
func validateExceptionImport(b exceptionExportBody) (string, int) {
	if err := validateExceptionType(b.ExceptionType); err != nil {
		return err.Error(), http.StatusBadRequest
	}
	if b.StartsAt.IsZero() {
		return "startsAt is required", http.StatusBadRequest
	}
	if b.EndsAt.IsZero() {
		return "endsAt is required", http.StatusBadRequest
	}
	if !b.EndsAt.After(b.StartsAt) {
		return "endsAt must be after startsAt", http.StatusBadRequest
	}
	if msg := validateFieldLen(b.Reason, maxReasonLen, "reason"); msg != nil {
		return msg.Error(), http.StatusBadRequest
	}
	if msg := validateFieldLen(b.TicketRef, maxTicketRefLen, "ticketRef"); msg != nil {
		return msg.Error(), http.StatusBadRequest
	}
	if msg := validateNamespaceFilter(b.NamespaceFilter); msg != "" {
		return msg, http.StatusBadRequest
	}
	if time.Until(b.StartsAt) < 0 {
		return "startsAt must be in the future; the imported exception window has already begun", http.StatusUnprocessableEntity
	}
	return "", 0
}
