// Package api exposes the calculator over HTTP as a JSON REST API.
package api

import (
	"log/slog"
	"net/http"
)

// Config controls how the router is assembled.
type Config struct {
	// AllowedOrigin is sent as Access-Control-Allow-Origin. Empty disables CORS
	// headers, which is correct when the frontend is served from the same origin.
	AllowedOrigin string
	// StaticDir, if set, is a directory of built frontend assets served at "/".
	StaticDir string
	// Logger receives one line per request. Defaults to slog.Default().
	Logger *slog.Logger
}

// NewRouter builds the HTTP handler with all routes and middleware registered.
func NewRouter(cfg Config) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", handleHealth)
	mux.HandleFunc("GET /api/v1/operations", handleListOperations)
	mux.HandleFunc("POST /api/v1/{operation}", handleCalculate)
	// Any other /api path is a JSON 404 rather than falling through to the SPA.
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "route not found")
	})

	if cfg.StaticDir != "" {
		mux.Handle("/", spaHandler(cfg.StaticDir))
	}

	var h http.Handler = mux
	h = withCORS(cfg.AllowedOrigin, h)
	h = withLogging(logger, h)
	h = withRecovery(logger, h)
	return h
}
