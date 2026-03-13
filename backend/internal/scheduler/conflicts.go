package scheduler

import (
	"encoding/json"
	"strings"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ConflictResult describes the outcome of conflict detection for a policy pair.
type ConflictResult struct {
	Type     string                 // "conflict" | "absorbed" | "no_op" | "guardrail_shadow"
	PolicyID uint                   // the policy being assessed
	OtherID  *uint                  // the other policy involved (nil for no_op / guardrail_shadow)
	Message  string
	Detail   map[string]interface{}
}

// DetectConflicts runs conflict detection for newPolicy against all other policies.
// It returns all ConflictResults. It never blocks saving.
func DetectConflicts(newPolicy store.SleepPolicy, allPolicies []store.SleepPolicy, globalGuardrails store.GlobalGuardrails) []ConflictResult {
	var results []ConflictResult

	// Check NO-OP: all namespaces in policy filter are in global skip_namespaces
	if newPolicy.NamespaceFilter != "" {
		globalSkip := splitCSV(globalGuardrails.SkipNamespaces)
		policyNS := splitCSVList(newPolicy.NamespaceFilter)
		allSkipped := true
		for _, ns := range policyNS {
			if !globalSkip[ns] {
				allSkipped = false
				break
			}
		}
		if allSkipped && len(policyNS) > 0 {
			results = append(results, ConflictResult{
				Type:     "no_op",
				PolicyID: newPolicy.ID,
				Message:  "All namespaces in policy filter are covered by global skip_namespaces — this policy never executes",
				Detail:   map[string]interface{}{"namespaces": policyNS},
			})
		}
	}

	for _, candidate := range allPolicies {
		if candidate.ID == newPolicy.ID {
			continue
		}
		if !candidate.Enabled {
			continue
		}

		// Check namespace overlap
		if !namespaceOverlap(newPolicy.NamespaceFilter, candidate.NamespaceFilter) {
			continue
		}

		// Build day sets for each policy
		newDays := collectDays(newPolicy.Windows)
		candidateDays := collectDays(candidate.Windows)
		sharedDays := intersectDays(newDays, candidateDays)
		if len(sharedDays) == 0 {
			continue
		}

		// Check direct time overlap
		if windowsOverlap(newPolicy.Windows, candidate.Windows, sharedDays) {
			other := candidate.ID
			results = append(results, ConflictResult{
				Type:     "conflict",
				PolicyID: newPolicy.ID,
				OtherID:  &other,
				Message:  "Overlapping sleep windows on shared days with policy: " + candidate.Name,
				Detail: map[string]interface{}{
					"otherPolicyId":   candidate.ID,
					"otherPolicyName": candidate.Name,
					"sharedDays":      sharedDays,
				},
			})
		}

		// Check if candidate is absorbed by new policy
		// (all of candidate's awake windows are fully contained within new policy's awake windows)
		if allWindowsContained(newPolicy.Windows, candidate.Windows) {
			other := candidate.ID
			results = append(results, ConflictResult{
				Type:     "absorbed",
				PolicyID: candidate.ID,
				OtherID:  &other,
				Message:  "Policy '" + candidate.Name + "' is absorbed by '" + newPolicy.Name + "' — it has no independent effect",
				Detail: map[string]interface{}{
					"absorbingPolicyId":   newPolicy.ID,
					"absorbingPolicyName": newPolicy.Name,
				},
			})
		}

		// Check guardrail shadow: policy-level rule duplicates a global rule
		checkGuardrailShadow(newPolicy, candidate, globalGuardrails, &results)
	}

	return results
}

// namespaceOverlap returns true if either filter is empty (covers all namespaces)
// or the two comma-separated lists share at least one namespace.
func namespaceOverlap(a, b string) bool {
	if a == "" || b == "" {
		return true // either covers all namespaces
	}
	setA := splitCSV(a)
	for _, ns := range splitCSVList(b) {
		if setA[ns] {
			return true
		}
	}
	return false
}

// windowTuple represents a (day, startMins, endMins) interval.
type windowTuple struct {
	day      string
	startMin int // minutes since midnight
	endMin   int // minutes since midnight; may wrap (endMin > 1440 for overnight)
}

// windowsOverlap returns true if any sleep windows from policy a and b overlap
// on the given shared days.
func windowsOverlap(aWindows, bWindows []store.PolicyWindow, sharedDays []string) bool {
	aIntervals := buildIntervals(aWindows, sharedDays)
	bIntervals := buildIntervals(bWindows, sharedDays)

	for _, ia := range aIntervals {
		for _, ib := range bIntervals {
			if ia.day != ib.day {
				continue
			}
			// Check overlap: two intervals [s1,e1] and [s2,e2] overlap iff s1 < e2 && s2 < e1
			if ia.startMin < ib.endMin && ib.startMin < ia.endMin {
				return true
			}
		}
	}
	return false
}

// buildIntervals converts windows to (day, startMin, endMin) tuples for the given days.
// Overnight windows produce two tuples: (day, start, 1440) and (nextDay, 0, end).
func buildIntervals(windows []store.PolicyWindow, filterDays []string) []windowTuple {
	dayFilter := make(map[string]bool, len(filterDays))
	for _, d := range filterDays {
		dayFilter[d] = true
	}

	var tuples []windowTuple
	for _, w := range windows {
		days := parseDaysOfWeek(w.DaysOfWeek)
		sleepMin := parseHHMM(w.SleepAt)
		if sleepMin < 0 {
			continue
		}

		var wakeMin int
		hasWake := w.WakeAt != ""
		if hasWake {
			wakeMin = parseHHMM(w.WakeAt)
		}

		for _, day := range days {
			if !dayFilter[day] {
				continue
			}

			if !hasWake {
				// Sleep-only: treat as sleep → midnight
				tuples = append(tuples, windowTuple{day: day, startMin: sleepMin, endMin: 1440})
				continue
			}

			if wakeMin > sleepMin {
				// Same-day: sleep at sleepMin, wake at wakeMin
				tuples = append(tuples, windowTuple{day: day, startMin: sleepMin, endMin: wakeMin})
			} else {
				// Overnight: sleep on this day, wake the next
				tuples = append(tuples, windowTuple{day: day, startMin: sleepMin, endMin: 1440})
				nextDay := nextDayOfWeek(day)
				if dayFilter[nextDay] {
					tuples = append(tuples, windowTuple{day: nextDay, startMin: 0, endMin: wakeMin})
				}
			}
		}
	}
	return tuples
}

// allWindowsContained returns true if all of b's awake windows are fully within a's awake windows.
// This is a simplified check: if every (day, time) pair b is awake is also a time a is awake.
func allWindowsContained(aWindows, bWindows []store.PolicyWindow) bool {
	if len(aWindows) == 0 || len(bWindows) == 0 {
		return false
	}
	// Get all days that b operates on
	bDays := collectDays(bWindows)
	bIntervals := buildIntervals(bWindows, bDays)
	aIntervals := buildIntervals(aWindows, bDays)

	for _, bi := range bIntervals {
		contained := false
		for _, ai := range aIntervals {
			if ai.day == bi.day && ai.startMin <= bi.startMin && ai.endMin >= bi.endMin {
				contained = true
				break
			}
		}
		if !contained {
			return false
		}
	}
	return len(bIntervals) > 0
}

// checkGuardrailShadow checks if a per-policy rule duplicates a global rule.
func checkGuardrailShadow(newPolicy, candidate store.SleepPolicy, global store.GlobalGuardrails, results *[]ConflictResult) {
	if newPolicy.Guardrails == nil {
		return
	}
	g := newPolicy.Guardrails
	globalSkipNS := splitCSV(global.SkipNamespaces)

	// Check if any skip_namespace in policy guardrails duplicates a global one
	for _, ns := range splitCSVList(g.SkipNamespaces) {
		if globalSkipNS[ns] {
			*results = append(*results, ConflictResult{
				Type:     "guardrail_shadow",
				PolicyID: newPolicy.ID,
				Message:  "Policy guardrail skip_namespaces includes '" + ns + "' which is already in global skip_namespaces",
				Detail:   map[string]interface{}{"namespace": ns},
			})
		}
	}
}

// collectDays returns all unique day strings across all windows of a policy.
func collectDays(windows []store.PolicyWindow) []string {
	seen := map[string]bool{}
	var days []string
	for _, w := range windows {
		for _, d := range parseDaysOfWeek(w.DaysOfWeek) {
			if !seen[d] {
				seen[d] = true
				days = append(days, d)
			}
		}
	}
	return days
}

// intersectDays returns the intersection of two day slices.
func intersectDays(a, b []string) []string {
	setA := make(map[string]bool, len(a))
	for _, d := range a {
		setA[d] = true
	}
	var result []string
	seen := map[string]bool{}
	for _, d := range b {
		if setA[d] && !seen[d] {
			result = append(result, d)
			seen[d] = true
		}
	}
	return result
}

// parseDaysOfWeek parses a JSON array like ["mon","tue","wed"] into a []string.
func parseDaysOfWeek(raw string) []string {
	var days []string
	if err := json.Unmarshal([]byte(raw), &days); err != nil {
		return nil
	}
	return days
}

// parseHHMM parses "HH:MM" into minutes since midnight. Returns -1 on error.
func parseHHMM(hhmm string) int {
	if len(hhmm) != 5 || hhmm[2] != ':' {
		return -1
	}
	h := int(hhmm[0]-'0')*10 + int(hhmm[1]-'0')
	m := int(hhmm[3]-'0')*10 + int(hhmm[4]-'0')
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return -1
	}
	return h*60 + m
}

// nextDayOfWeek returns the day following the given day abbreviation.
var dowOrder = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

func nextDayOfWeek(day string) string {
	for i, d := range dowOrder {
		if d == day {
			return dowOrder[(i+1)%7]
		}
	}
	return ""
}

// splitCSV returns a set from a comma-separated string.
func splitCSV(s string) map[string]bool {
	m := map[string]bool{}
	for _, v := range strings.Split(s, ",") {
		v = strings.TrimSpace(v)
		if v != "" {
			m[v] = true
		}
	}
	return m
}

// splitCSVList returns a slice from a comma-separated string (trimmed, no empties).
func splitCSVList(s string) []string {
	var out []string
	for _, v := range strings.Split(s, ",") {
		v = strings.TrimSpace(v)
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}
