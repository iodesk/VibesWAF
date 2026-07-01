package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed frontend/dist
var frontendDist embed.FS

// newUIHandler returns an http.Handler that serves the embedded frontend dist.
// Unknown paths fall back to index.html for client-side routing (SPA).
func newUIHandler() http.Handler {
	sub, err := fs.Sub(frontendDist, "frontend/dist")
	if err != nil {
		panic("ui: failed to sub frontend/dist: " + err.Error())
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path != "" && path[0] == '/' {
			path = path[1:]
		}
		if _, err := sub.Open(path); err != nil {
			// SPA fallback — serve index.html for any unknown path
			r2 := *r
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, &r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
