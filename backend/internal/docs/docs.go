// SPDX-License-Identifier: Apache-2.0

// Package docs embeds and serves the OpenAPI specification at /api/docs/.
package docs

import (
	_ "embed"
	"net/http"
	"strconv"
)

//go:embed openapi.yaml
var spec []byte

// SpecHandler serves the embedded OpenAPI spec as application/yaml.
func SpecHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/yaml")
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("Content-Length", strconv.Itoa(len(spec)))
		_, _ = w.Write(spec)
	})
}
