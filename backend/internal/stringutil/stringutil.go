// SPDX-License-Identifier: Apache-2.0

// Package stringutil provides CSV string splitting and set conversion helpers.
package stringutil

import "strings"

// SplitCSV splits a comma-separated string into a trimmed slice,
// discarding empty segments.
func SplitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			values = append(values, part)
		}
	}
	return values
}

// SplitCSVSet splits a comma-separated string into a trimmed set (map),
// discarding empty segments.
func SplitCSVSet(s string) map[string]bool {
	values := map[string]bool{}
	for _, value := range SplitCSV(s) {
		values[value] = true
	}
	return values
}
