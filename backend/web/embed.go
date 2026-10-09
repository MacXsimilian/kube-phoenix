// SPDX-License-Identifier: Apache-2.0

// Package web embeds the compiled Next.js static export.
// Run `make build` from the repo root to populate the static/ directory
// before building the Go binary.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:static
var staticFiles embed.FS

// SPAHandler returns an http.Handler that serves the embedded Next.js static
// export with a proper SPA fallback: unknown paths fall back to index.html.
func SPAHandler() http.Handler {
	// fs.Sub on an embedded filesystem should never fail; panic is acceptable at init time.
	fsys, err := fs.Sub(staticFiles, "static")
	if err != nil {
		panic("web: failed to sub static FS: " + err.Error())
	}
	return spaHandler(fsys)
}

func spaHandler(fsys fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(fsys))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		// Trailing-slash page URLs use an index file in the static export.
		if path == "" || strings.HasSuffix(path, "/") {
			path += "index.html"
		}

		if fs.ValidPath(path) {
			if f, err := fsys.Open(path); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Path not found — serve root index.html for client-side routing
		fallbackRequest := r.Clone(r.Context())
		fallbackRequest.URL.Path = "/"
		fileServer.ServeHTTP(w, fallbackRequest)
	})
}
