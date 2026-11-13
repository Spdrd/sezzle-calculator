package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/Spdrd/sezzle-calculator/backend/internal/calculator"
)

// maxBodyBytes bounds request bodies; a valid request is a few dozen bytes.
const maxBodyBytes = 1 << 10

// CalculateRequest is the body accepted by POST /api/v1/{operation}.
// Operands are pointers so that a JSON null (which encoding/json would
// otherwise silently decode as 0) can be detected and rejected.
type CalculateRequest struct {
	Operands []*float64 `json:"operands"`
}

// values returns the operands as plain numbers, or false if any is null.
func (r CalculateRequest) values() ([]float64, bool) {
	out := make([]float64, len(r.Operands))
	for i, v := range r.Operands {
		if v == nil {
			return nil, false
		}
		out[i] = *v
	}
	return out, true
}

// CalculateResponse is returned on a successful calculation.
type CalculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

// ErrorResponse is the envelope for every error returned by the API.
type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody carries a stable machine-readable code and a human-readable message.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleListOperations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"operations": calculator.Operations()})
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	op := calculator.Operation(r.PathValue("operation"))
	if _, ok := calculator.Arity(op); !ok {
		writeError(w, http.StatusNotFound, "unknown_operation", fmt.Sprintf("unknown operation %q", op))
		return
	}

	var req CalculateRequest
	if status, code, msg := decodeJSON(w, r, &req); status != 0 {
		writeError(w, status, code, msg)
		return
	}

	operands, ok := req.values()
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid_operand", "operands must not be null")
		return
	}

	result, err := calculator.Calculate(op, operands...)
	if err != nil {
		status, code := classify(err)
		writeError(w, status, code, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Operation: op, Operands: operands, Result: result})
}

// decodeJSON strictly decodes a single JSON object from the request body.
// It returns a zero status on success, otherwise the HTTP status, error code
// and message to report.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) (int, string, string) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		var typeErr *json.UnmarshalTypeError
		switch {
		case errors.As(err, &maxErr):
			return http.StatusRequestEntityTooLarge, "body_too_large", "request body is too large"
		case errors.Is(err, io.EOF):
			return http.StatusBadRequest, "invalid_json", "request body is empty"
		case errors.As(err, &typeErr):
			return http.StatusBadRequest, "invalid_operand", "operands must be an array of numbers within range"
		default:
			return http.StatusBadRequest, "invalid_json", "request body is not valid JSON: " + err.Error()
		}
	}
	if dec.More() {
		return http.StatusBadRequest, "invalid_json", "request body must contain a single JSON object"
	}
	return 0, "", ""
}

// classify maps calculator errors to HTTP statuses and stable error codes.
// Malformed requests are 400; well-formed requests whose maths has no answer
// are 422 (Unprocessable Content).
func classify(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrOperandCount):
		return http.StatusBadRequest, "invalid_operand_count"
	case errors.Is(err, calculator.ErrInvalidOperand):
		return http.StatusBadRequest, "invalid_operand"
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "division_by_zero"
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, "negative_sqrt"
	case errors.Is(err, calculator.ErrUndefinedResult):
		return http.StatusUnprocessableEntity, "undefined_result"
	case errors.Is(err, calculator.ErrResultOutOfRange):
		return http.StatusUnprocessableEntity, "result_out_of_range"
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusNotFound, "unknown_operation"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorResponse{Error: ErrorBody{Code: code, Message: message}})
}
