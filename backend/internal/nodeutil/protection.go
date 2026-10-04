// SPDX-License-Identifier: Apache-2.0

// Package nodeutil provides shared node protection logic for matching labels,
// taints, and pod priority classes against guardrail configurations.
package nodeutil

import (
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/validate/content"
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
// entries are dropped.
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
		key, value, err := parseLabelEntry(kv)
		if err != nil {
			continue
		}
		out = append(out, LabelMatcher{Key: key, Value: value, Raw: kv})
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
		key, value, effect, err := parseTaintEntry(kv)
		if err != nil {
			continue
		}
		out = append(out, TaintMatcher{Key: key, Value: value, Effect: corev1.TaintEffect(effect), Raw: kv})
	}
	return out
}

// ValidateLabels applies the same entry validation used by ParseLabels.
// Empty CSV entries are ignored, allowing an intentionally empty guardrail.
func ValidateLabels(csvConfig string) error {
	for _, entry := range strings.Split(csvConfig, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if _, _, err := parseLabelEntry(entry); err != nil {
			return fmt.Errorf("invalid node label %q: %w", entry, err)
		}
	}
	return nil
}

// ValidateTaints applies the same entry validation used by ParseTaints.
func ValidateTaints(csvConfig string) error {
	for _, entry := range strings.Split(csvConfig, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if _, _, _, err := parseTaintEntry(entry); err != nil {
			return fmt.Errorf("invalid node taint %q: %w", entry, err)
		}
	}
	return nil
}

func parseLabelEntry(entry string) (key, value string, err error) {
	key, value, ok := strings.Cut(entry, "=")
	if !ok {
		return "", "", fmt.Errorf("must be key=value")
	}
	if problems := content.IsLabelKey(key); len(problems) > 0 {
		return "", "", fmt.Errorf("invalid key: %s", strings.Join(problems, "; "))
	}
	if problems := content.IsLabelValue(value); len(problems) > 0 {
		return "", "", fmt.Errorf("invalid value: %s", strings.Join(problems, "; "))
	}
	return key, value, nil
}

// The value may be empty, e.g. node.kubernetes.io/unschedulable=:NoSchedule.
func parseTaintEntry(entry string) (key, value, effect string, err error) {
	label, effect, ok := strings.Cut(entry, ":")
	if !ok {
		return "", "", "", fmt.Errorf("must be key=value:effect")
	}
	key, value, err = parseLabelEntry(label)
	if err != nil {
		return "", "", "", err
	}
	switch corev1.TaintEffect(effect) {
	case corev1.TaintEffectNoSchedule, corev1.TaintEffectPreferNoSchedule, corev1.TaintEffectNoExecute:
		return key, value, effect, nil
	default:
		return "", "", "", fmt.Errorf("effect must be NoSchedule, PreferNoSchedule or NoExecute")
	}
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
