// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scheduler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"

	"k8s.io/apimachinery/pkg/labels"
)

// reNamespace matches valid Kubernetes namespace names (RFC 1123 DNS label).
var reNamespace = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

func validateNamespaceFilter(filter string) string {
	if filter == "" {
		return ""
	}
	for _, ns := range strings.Split(filter, ",") {
		ns = strings.TrimSpace(ns)
		if ns == "" {
			continue
		}
		if len(ns) > 63 {
			return fmt.Sprintf("namespace %q exceeds the 63-character limit", ns)
		}
		if !reNamespace.MatchString(ns) {
			return fmt.Sprintf("%q is not a valid namespace name (lowercase alphanumeric and hyphens only, must start and end with alphanumeric)", ns)
		}
	}
	return ""
}

// validateAndPreparePolicy validates the input, serialises sleep windows, and
// applies defaults (timezone, mode, initial state). Returns the prepared policy
// and an error message (empty on success).
func validateAndPreparePolicy(input createPolicyInput) (store.Policy, string) {
	p := input.Policy
	if p.Name == "" {
		return p, "name is required"
	}
	if len(input.SleepWindows) == 0 {
		return p, "sleepWindows is required"
	}
	if err := policy.ValidateWindows(input.SleepWindows); err != nil {
		return p, err.Error()
	}
	windowsJSON, err := json.Marshal(input.SleepWindows)
	if err != nil {
		return p, "failed to marshal sleep windows"
	}
	p.SleepWindows = string(windowsJSON)

	if msg := validatePolicyFields(p); msg != "" {
		return p, msg
	}
	if p.Timezone == "" {
		p.Timezone = "UTC"
	}
	if p.Mode == "" {
		p.Mode = "plan"
	}

	now := time.Now()
	initialState := scheduler.IntendedState(scheduler.StateInput{
		Windows: input.SleepWindows, Timezone: p.Timezone, Now: now,
	})
	p.CurrentState = string(initialState)
	p.StateSince = &now

	return p, ""
}

// checkPolicyOverlap verifies that an apply-mode policy won't conflict with
// existing policies. Returns an error message if overlap is detected, or "".
func (h *Handler) checkPolicyOverlap(id uint, old *store.Policy, updates map[string]interface{}) (string, error) {
	finalMode := old.Mode
	if v, ok := updates["mode"]; ok {
		finalMode = fmt.Sprintf("%v", v)
	}
	if finalMode != store.PolicyModeApply {
		return "", nil
	}
	finalNS := old.NamespaceFilter
	if v, ok := updates["namespace_filter"]; ok {
		finalNS = fmt.Sprintf("%v", v)
	}
	overlap, err := h.store.HasApplyPolicyOverlap(id, finalNS)
	if err != nil {
		return "", err
	}
	if overlap {
		return "an existing apply-mode policy may overlap with these targets; resolve the conflict before saving", nil
	}
	return "", nil
}

// ─── Validation ───────────────────────────────────────────────────────────────

// validatePolicyMode checks that mode is a recognised value.
func validatePolicyMode(mode string) string {
	if mode != "" && mode != store.PolicyModePlan && mode != store.PolicyModeApply {
		return "mode must be plan or apply"
	}
	return ""
}

// validatePolicyTimezone checks that tz is a valid IANA timezone.
func validatePolicyTimezone(tz string) string {
	if tz != "" {
		if _, err := time.LoadLocation(tz); err != nil {
			return "invalid timezone"
		}
	}
	return ""
}

// validatePolicyName returns an error message if the name is too long.
func validatePolicyName(name string) string {
	if len(name) > maxNameLen {
		return "name must be 255 characters or fewer"
	}
	return ""
}

// validatePolicyDescription returns an error message if the description is too long.
func validatePolicyDescription(desc string) string {
	if len(desc) > maxDescriptionLen {
		return "description must be 1024 characters or fewer"
	}
	return ""
}

// validatePolicyLabelSelector returns an error message if the label selector is
// too long or syntactically invalid.
func validatePolicyLabelSelector(sel string) string {
	if len(sel) > maxLabelSelectorLen {
		return "labelSelector must be 4096 characters or fewer"
	}
	if sel != "" {
		if _, err := labels.Parse(sel); err != nil {
			return fmt.Sprintf("invalid labelSelector: %v", err)
		}
	}
	return ""
}

// validatePolicyTimeout returns an error message if the timeout is out of range.
func validatePolicyTimeout(minutes int) string {
	if minutes < 0 || minutes > 1440 {
		return "timeoutMinutes must be between 0 and 1440"
	}
	return ""
}

func validatePolicyFields(p store.Policy) string {
	validators := []string{
		validatePolicyName(p.Name),
		validatePolicyDescription(p.Description),
		validatePolicyLabelSelector(p.LabelSelector),
		validatePolicyTimeout(p.TimeoutMinutes),
		validatePolicyMode(p.Mode),
		validatePolicyTimezone(p.Timezone),
		validateNamespaceFilter(p.NamespaceFilter),
	}
	for _, msg := range validators {
		if msg != "" {
			return msg
		}
	}
	return ""
}

var policyUpdateStringChecks = []struct {
	key      string
	validate func(string) string
}{
	{"name", validatePolicyName},
	{"mode", validatePolicyMode},
	{"timezone", validatePolicyTimezone},
	{"namespace_filter", validateNamespaceFilter},
	{"description", validatePolicyDescription},
	{"label_selector", validatePolicyLabelSelector},
}

func validatePolicyUpdates(updates map[string]interface{}) string {
	for _, check := range policyUpdateStringChecks {
		v, ok := updates[check.key]
		if !ok {
			continue
		}
		if msg := check.validate(fmt.Sprintf("%v", v)); msg != "" {
			return msg
		}
	}
	if v, ok := updates["timeout_minutes"]; ok {
		if f, ok := v.(float64); ok {
			if msg := validatePolicyTimeout(int(f)); msg != "" {
				return msg
			}
		}
	}
	return ""
}
