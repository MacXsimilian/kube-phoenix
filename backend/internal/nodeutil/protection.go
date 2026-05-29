// SPDX-License-Identifier: Apache-2.0

// Package nodeutil provides shared node protection logic for matching labels,
// taints, and pod priority classes against guardrail configurations.
package nodeutil

import (
	"strings"

	corev1 "k8s.io/api/core/v1"
)

// LabelMatcher is a single parsed key=value pair from a label CSV config.
type LabelMatcher struct {
	Key   string
	Value string
	Raw   string // original "key=value" form, returned on match
}

// TaintMatcher is a single parsed key=value:effect entry from a taint CSV config.
type TaintMatcher struct {
	Key    string
	Value  string
	Effect corev1.TaintEffect
	Raw    string
}

// ParseLabels splits a CSV config of key=value pairs into matchers. Invalid
// entries (missing '=' or empty key) are dropped.
func ParseLabels(csvConfig string) []LabelMatcher {
	if csvConfig == "" {
		return nil
	}
	parts := strings.Split(csvConfig, ",")
	out := make([]LabelMatcher, 0, len(parts))
	for _, kv := range parts {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		kvParts := strings.SplitN(kv, "=", 2)
		if len(kvParts) != 2 || kvParts[0] == "" {
			continue
		}
		out = append(out, LabelMatcher{Key: kvParts[0], Value: kvParts[1], Raw: kv})
	}
	return out
}

// ParseTaints splits a CSV config of key=value:effect entries into matchers.
// Invalid entries are dropped.
func ParseTaints(csvConfig string) []TaintMatcher {
	if csvConfig == "" {
		return nil
	}
	parts := strings.Split(csvConfig, ",")
	out := make([]TaintMatcher, 0, len(parts))
	for _, kv := range parts {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		key, value, effect, ok := splitTaintEntry(kv)
		if !ok {
			continue
		}
		out = append(out, TaintMatcher{Key: key, Value: value, Effect: corev1.TaintEffect(effect), Raw: kv})
	}
	return out
}

// splitTaintEntry parses "key=value:effect" into its three components. The
// value segment may be empty (e.g. node.kubernetes.io/unschedulable=:NoSchedule).
func splitTaintEntry(entry string) (key, value, effect string, ok bool) {
	eq := strings.Index(entry, "=")
	colon := strings.LastIndex(entry, ":")
	if eq <= 0 || colon < eq+1 || colon == len(entry)-1 {
		return "", "", "", false
	}
	return entry[:eq], entry[eq+1 : colon], entry[colon+1:], true
}

// MatchLabel checks if any node label matches a CSV config of key=value pairs.
// Returns the matched entry (e.g., "key=value") or "" if no match.
func MatchLabel(nodeLabels map[string]string, csvConfig string) string {
	return MatchLabelParsed(nodeLabels, ParseLabels(csvConfig))
}

// MatchLabelParsed checks node labels against preparsed matchers. Used by hot
// paths that loop over many nodes with the same guardrail config.
func MatchLabelParsed(nodeLabels map[string]string, matchers []LabelMatcher) string {
	for _, m := range matchers {
		if v, ok := nodeLabels[m.Key]; ok && v == m.Value {
			return m.Raw
		}
	}
	return ""
}

// IsCriticalPod returns true if the pod uses the system-node-critical or
// system-cluster-critical PriorityClassName.
func IsCriticalPod(priorityClassName string) bool {
	return priorityClassName == "system-node-critical" ||
		priorityClassName == "system-cluster-critical"
}

// MatchTaint checks if any node taint matches a CSV config of key=value:effect entries.
// Returns the matched entry or "" if no match.
func MatchTaint(nodeTaints []corev1.Taint, csvConfig string) string {
	return MatchTaintParsed(nodeTaints, ParseTaints(csvConfig))
}

// MatchTaintParsed checks node taints against preparsed matchers.
func MatchTaintParsed(nodeTaints []corev1.Taint, matchers []TaintMatcher) string {
	for _, m := range matchers {
		for _, taint := range nodeTaints {
			if taint.Key == m.Key && taint.Value == m.Value && taint.Effect == m.Effect {
				return m.Raw
			}
		}
	}
	return ""
}
