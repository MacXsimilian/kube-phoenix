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
	fileServer := http.FileServer(http.FS(fsys))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Try to open the requested path
		f, err := fsys.Open(path)
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Path not found — serve root index.html for client-side routing
		r2 := r.Clone(r.Context())
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, r2)
	})
}
