package scheduler

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// NotificationService generates and persists notifications.
type NotificationService struct {
	store *store.Store
}

func NewNotificationService(st *store.Store) *NotificationService {
	return &NotificationService{store: st}
}

// NotifyConflicts creates notifications for all detected conflicts.
func (ns *NotificationService) NotifyConflicts(results []ConflictResult) {
	for _, r := range results {
		detail, _ := json.Marshal(r.Detail)

		var severity, notifType string
		switch r.Type {
		case "conflict":
			notifType = "conflict"
			severity = "warning"
		case "absorbed":
			notifType = "absorbed"
			severity = "info"
		case "no_op":
			notifType = "no_op"
			severity = "warning"
		case "guardrail_shadow":
			notifType = "guardrail_shadow"
			severity = "info"
		default:
			continue
		}

		n := &store.Notification{
			PolicyID: ptrUint(r.PolicyID),
			Type:     notifType,
			Severity: severity,
			Message:  r.Message,
			Detail:   detail,
		}
		if err := ns.store.CreateNotification(n); err != nil {
			slog.Error("notifications: failed to create conflict notification",
				"policyID", r.PolicyID, "type", r.Type, "err", err)
		}
	}
}

// NotifyExecutionFailed creates a notification when an execution fails.
func (ns *NotificationService) NotifyExecutionFailed(execID uint, policyID *uint, msg string) {
	n := &store.Notification{
		PolicyID:    policyID,
		ExecutionID: ptrUint(execID),
		Type:        "execution_failed",
		Severity:    "error",
		Message:     fmt.Sprintf("Execution %d failed: %s", execID, msg),
	}
	if err := ns.store.CreateNotification(n); err != nil {
		slog.Error("notifications: failed to create execution_failed notification", "execID", execID, "err", err)
	}
}

// NotifyDriftCorrected creates a notification when a drift correction runs in record mode.
func (ns *NotificationService) NotifyDriftCorrected(execID uint, policyID *uint, namespace string) {
	n := &store.Notification{
		PolicyID:    policyID,
		ExecutionID: ptrUint(execID),
		Type:        "drift_corrected",
		Severity:    "info",
		Message:     fmt.Sprintf("Drift correction applied to namespace '%s'", namespace),
	}
	if err := ns.store.CreateNotification(n); err != nil {
		slog.Error("notifications: failed to create drift_corrected notification", "execID", execID, "err", err)
	}
}

func ptrUint(v uint) *uint { return &v }
