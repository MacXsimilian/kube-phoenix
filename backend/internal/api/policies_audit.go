// SPDX-License-Identifier: Apache-2.0

package api

import (
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// policyAuditSnapshot builds a clean map for audit logs, omitting null/zero
// derived-state fields that carry no information on create events.
func policyAuditSnapshot(p store.Policy) map[string]interface{} {
	m := map[string]interface{}{
		"id":           p.ID,
		"name":         p.Name,
		"mode":         p.Mode,
		"enabled":      p.Enabled,
		"currentState": p.CurrentState,
		"timezone":     p.Timezone,
		"createdAt":    p.CreatedAt,
	}
	if p.Description != "" {
		m["description"] = p.Description
	}
	if p.NamespaceFilter != "" {
		m["namespaceFilter"] = p.NamespaceFilter
	}
	if p.LabelSelector != "" {
		m["labelSelector"] = p.LabelSelector
	}
	if p.TimeoutMinutes != 0 {
		m["timeoutMinutes"] = p.TimeoutMinutes
	}
	if p.StateSince != nil {
		m["stateSince"] = p.StateSince
	}
	if p.LastSleepAt != nil {
		m["lastSleepAt"] = p.LastSleepAt
	}
	if p.LastWakeAt != nil {
		m["lastWakeAt"] = p.LastWakeAt
	}
	return m
}
