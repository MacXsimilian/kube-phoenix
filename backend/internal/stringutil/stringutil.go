package stringutil

import "strings"

// SplitCSV splits a comma-separated string into a trimmed slice,
// discarding empty segments.
func SplitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// SplitCSVSet splits a comma-separated string into a trimmed set (map),
// discarding empty segments.
func SplitCSVSet(s string) map[string]bool {
	m := map[string]bool{}
	for _, v := range SplitCSV(s) {
		m[v] = true
	}
	return m
}
