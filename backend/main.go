// Command backend runs the calculator REST API.
//
// Configuration comes from environment variables:
//
//	PORT         port to listen on (default 8080)
//	CORS_ORIGIN  allowed browser origin (default http://localhost:5173; "" disables CORS)
//	STATIC_DIR   optional directory of built frontend assets to serve at "/"
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Spdrd/sezzle-calculator/backend/internal/api"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	port := envOr("PORT", "8080")
	origin, ok := os.LookupEnv("CORS_ORIGIN")
	if !ok {
		origin = "http://localhost:5173"
	}

	srv := &http.Server{
		Addr: ":" + port,
		Handler: api.NewRouter(api.Config{
			AllowedOrigin: origin,
			StaticDir:     os.Getenv("STATIC_DIR"),
			Logger:        logger,
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("API listening", "addr", "http://localhost:"+port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
