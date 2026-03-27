package nodeutil

import (
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
)

// MatchLabel checks if any node label matches a CSV config of key=value pairs.
// Returns the matched entry (e.g., "key=value") or "" if no match.
func MatchLabel(nodeLabels map[string]string, csvConfig string) string {
	for _, kv := range strings.Split(csvConfig, ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) != 2 {
			continue
		}
		if v, ok := nodeLabels[parts[0]]; ok && v == parts[1] {
			return kv
		}
	}
	return ""
}

// MatchTaint checks if any node taint matches a CSV config of key=value:effect entries.
// Returns the matched entry or "" if no match.
func MatchTaint(nodeTaints []corev1.Taint, csvConfig string) string {
	for _, kv := range strings.Split(csvConfig, ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		for _, taint := range nodeTaints {
			if fmt.Sprintf("%s=%s:%s", taint.Key, taint.Value, taint.Effect) == kv {
				return kv
			}
		}
	}
	return ""
}
