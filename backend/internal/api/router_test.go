package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Spdrd/sezzle-calculator/backend/internal/calculator"
)

func newTestRouter(t *testing.T, cfg Config) http.Handler {
	t.Helper()
	cfg.Logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	return NewRouter(cfg)
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealth(t *testing.T) {
	rec := do(t, newTestRouter(t, Config{}), http.MethodGet, "/api/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"status":"ok"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestListOperations(t *testing.T) {
	rec := do(t, newTestRouter(t, Config{}), http.MethodGet, "/api/v1/operations", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body struct {
		Operations []struct {
			Name  string `json:"name"`
			Arity int    `json:"arity"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Operations) != 7 {
		t.Fatalf("got %d operations, want 7", len(body.Operations))
	}
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		path, body string
		want       float64
	}{
		{"/api/v1/add", `{"operands":[2,3]}`, 5},
		{"/api/v1/subtract", `{"operands":[2,3]}`, -1},
		{"/api/v1/multiply", `{"operands":[2.5,4]}`, 10},
		{"/api/v1/divide", `{"operands":[1,8]}`, 0.125},
		{"/api/v1/power", `{"operands":[3,3]}`, 27},
		{"/api/v1/sqrt", `{"operands":[81]}`, 9},
		{"/api/v1/percentage", `{"operands":[20,50]}`, 10},
		{"/api/v1/add", `{"operands":[1e2,-1E-1]}`, 99.9},
	}
	h := newTestRouter(t, Config{})
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tt.path, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body %s", rec.Code, rec.Body.String())
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var resp CalculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if resp.Result != tt.want {
				t.Errorf("result = %v, want %v", resp.Result, tt.want)
			}
			if "/api/v1/"+string(resp.Operation) != tt.path {
				t.Errorf("operation = %q, want it to match %s", resp.Operation, tt.path)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name, method, path, body string
		wantStatus               int
		wantCode                 string
	}{
		{"division by zero", "POST", "/api/v1/divide", `{"operands":[1,0]}`, 422, "division_by_zero"},
		{"negative sqrt", "POST", "/api/v1/sqrt", `{"operands":[-4]}`, 422, "negative_sqrt"},
		{"undefined power", "POST", "/api/v1/power", `{"operands":[-8,0.5]}`, 422, "undefined_result"},
		{"overflow", "POST", "/api/v1/power", `{"operands":[10,309]}`, 422, "result_out_of_range"},
		{"unknown operation", "POST", "/api/v1/modulo", `{"operands":[1,2]}`, 404, "unknown_operation"},
		{"missing operands", "POST", "/api/v1/add", `{}`, 400, "invalid_operand_count"},
		{"too many operands", "POST", "/api/v1/sqrt", `{"operands":[1,2]}`, 400, "invalid_operand_count"},
		{"string operand", "POST", "/api/v1/add", `{"operands":["1",2]}`, 400, "invalid_operand"},
		{"null operand", "POST", "/api/v1/add", `{"operands":[null,2]}`, 400, "invalid_operand"},
		{"number out of float64 range", "POST", "/api/v1/add", `{"operands":[1e400,2]}`, 400, "invalid_operand"},
		{"operands not an array", "POST", "/api/v1/add", `{"operands":5}`, 400, "invalid_operand"},
		{"malformed json", "POST", "/api/v1/add", `{"operands":[1,2]`, 400, "invalid_json"},
		{"empty body", "POST", "/api/v1/add", ``, 400, "invalid_json"},
		{"unknown field", "POST", "/api/v1/add", `{"operands":[1,2],"a":1}`, 400, "invalid_json"},
		{"trailing data", "POST", "/api/v1/add", `{"operands":[1,2]}{"operands":[3,4]}`, 400, "invalid_json"},
		{"body too large", "POST", "/api/v1/add", `{"operands":[` + strings.Repeat("1,", 2000) + `1]}`, 413, "body_too_large"},
		{"unknown api route", "GET", "/api/v2/nothing", ``, 404, "not_found"},
	}
	h := newTestRouter(t, Config{})
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, h, tt.method, tt.path, tt.body)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			var resp ErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v (body %s)", err, rec.Body.String())
			}
			if resp.Error.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", resp.Error.Code, tt.wantCode)
			}
			if resp.Error.Message == "" {
				t.Error("error message is empty")
			}
		})
	}
}

func TestCORS(t *testing.T) {
	h := newTestRouter(t, Config{AllowedOrigin: "http://example.test"})

	rec := do(t, h, http.MethodOptions, "/api/v1/add", "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://example.test" {
		t.Errorf("Allow-Origin = %q", got)
	}

	rec = do(t, newTestRouter(t, Config{}), http.MethodGet, "/api/health", "")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("CORS header set with no origin configured: %q", got)
	}
}

func TestRecoveryReturnsJSON500(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := withRecovery(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))
	rec := do(t, h, http.MethodGet, "/", "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "internal_error") {
		t.Errorf("unexpected body: %s", rec.Body.String())
	}
}

func TestStaticFilesAndSPAFallback(t *testing.T) {
	dir := t.TempDir()
	mustWrite(t, filepath.Join(dir, "index.html"), "<html>app</html>")
	mustWrite(t, filepath.Join(dir, "app.js"), "console.log(1)")
	h := newTestRouter(t, Config{StaticDir: dir})

	for path, want := range map[string]string{
		"/":             "<html>app</html>",
		"/app.js":       "console.log(1)",
		"/some/route":   "<html>app</html>",
		"/assets/x.png": "<html>app</html>",
	} {
		rec := do(t, h, http.MethodGet, path, "")
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), want) {
			t.Errorf("GET %s = %d %q, want 200 containing %q", path, rec.Code, rec.Body.String(), want)
		}
	}

	// API routes must not be swallowed by the SPA fallback.
	if rec := do(t, h, http.MethodGet, "/api/unknown", ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET /api/unknown = %d, want 404", rec.Code)
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestClassify(t *testing.T) {
	tests := []struct {
		err        error
		wantStatus int
		wantCode   string
	}{
		{calculator.ErrUnknownOperation, http.StatusNotFound, "unknown_operation"},
		{calculator.ErrInvalidOperand, http.StatusBadRequest, "invalid_operand"},
		{fmt.Errorf("wrapped: %w", calculator.ErrDivisionByZero), http.StatusUnprocessableEntity, "division_by_zero"},
		{errors.New("something unexpected"), http.StatusInternalServerError, "internal_error"},
	}
	for _, tt := range tests {
		status, code := classify(tt.err)
		if status != tt.wantStatus || code != tt.wantCode {
			t.Errorf("classify(%v) = %d, %q; want %d, %q", tt.err, status, code, tt.wantStatus, tt.wantCode)
		}
	}
}
