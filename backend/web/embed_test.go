// SPDX-License-Identifier: Apache-2.0

package web

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestSPAHandlerExportedRoutes(t *testing.T) {
	files := fstest.MapFS{
		"index.html":                      {Data: []byte("root page")},
		"policies/index.html":             {Data: []byte("policies page")},
		"policies/detail/index.html":      {Data: []byte("policy detail page")},
		"observability/router/index.html": {Data: []byte("router page")},
		"_next/static/chunks/app.js":      {Data: []byte("console.log('app')")},
		"policies/detail/index.txt":       {Data: []byte("policy route data")},
	}
	handler := spaHandler(files)

	for _, tt := range []struct {
		name     string
		method   string
		target   string
		status   int
		body     string
		location string
	}{
		{name: "root", target: "/", status: http.StatusOK, body: "root page"},
		{name: "exported page", target: "/policies/", status: http.StatusOK, body: "policies page"},
		{name: "nested page with query", target: "/policies/detail/?id=7&exec=11", status: http.StatusOK, body: "policy detail page"},
		{name: "generated route", target: "/observability/router/", status: http.StatusOK, body: "router page"},
		{name: "directory redirect", target: "/policies?view=all", status: http.StatusMovedPermanently, location: "policies/?view=all"},
		{name: "nested directory redirect", target: "/policies/detail?id=7&exec=11", status: http.StatusMovedPermanently, location: "detail/?id=7&exec=11"},
		{name: "index redirect", target: "/policies/index.html?view=all", status: http.StatusMovedPermanently, location: "./?view=all"},
		{name: "static asset", target: "/_next/static/chunks/app.js?v=1", status: http.StatusOK, body: "console.log('app')"},
		{name: "route data", target: "/policies/detail/index.txt", status: http.StatusOK, body: "policy route data"},
		{name: "unknown route fallback", target: "/future/page/?id=7", status: http.StatusOK, body: "root page"},
		{name: "missing asset fallback", target: "/_next/static/missing.js", status: http.StatusOK, body: "root page"},
		{name: "indexless directory fallback", target: "/_next/static/", status: http.StatusOK, body: "root page"},
		{name: "indexless directory redirect", target: "/_next/static", status: http.StatusMovedPermanently, location: "static/"},
		{name: "file with trailing slash fallback", target: "/_next/static/chunks/app.js/", status: http.StatusOK, body: "root page"},
		{name: "head request", method: http.MethodHead, target: "/policies/detail/?id=7", status: http.StatusOK},
	} {
		t.Run(tt.name, func(t *testing.T) {
			method := tt.method
			if method == "" {
				method = http.MethodGet
			}
			req := httptest.NewRequestWithContext(t.Context(), method, tt.target, nil)
			originalURL := *req.URL
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)

			if recorder.Code != tt.status {
				t.Fatalf("status = %d, want %d", recorder.Code, tt.status)
			}
			if got := recorder.Header().Get("Location"); got != tt.location {
				t.Errorf("Location = %q, want %q", got, tt.location)
			}
			if tt.location == "" && recorder.Body.String() != tt.body {
				t.Errorf("body = %q, want %q", recorder.Body.String(), tt.body)
			}
			if *req.URL != originalURL {
				t.Errorf("request URL changed from %v to %v", originalURL, req.URL)
			}
		})
	}
}

func TestSPAHandlerInvalidPathsFallBackWithoutFilesystemTraversal(t *testing.T) {
	for _, target := range []string{
		"/../private.txt",
		"/policies/../../private.txt",
		"/policies/%2e%2e/private.txt",
		"/policies//detail/",
	} {
		t.Run(target, func(t *testing.T) {
			files := &validPathFS{FS: fstest.MapFS{
				"index.html":  {Data: []byte("root page")},
				"private.txt": {Data: []byte("not the fallback")},
			}}
			recorder := httptest.NewRecorder()
			spaHandler(files).ServeHTTP(recorder, httptest.NewRequestWithContext(t.Context(), http.MethodGet, target, nil))
			if recorder.Code != http.StatusOK || recorder.Body.String() != "root page" {
				t.Errorf("response = %d %q, want root fallback", recorder.Code, recorder.Body.String())
			}
			if len(files.invalidPaths) != 0 {
				t.Errorf("invalid filesystem paths opened: %v", files.invalidPaths)
			}
		})
	}
}

type validPathFS struct {
	fs.FS
	invalidPaths []string
}

func (f *validPathFS) Open(name string) (fs.File, error) {
	if !fs.ValidPath(name) {
		f.invalidPaths = append(f.invalidPaths, name)
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrInvalid}
	}
	return f.FS.Open(name)
}
