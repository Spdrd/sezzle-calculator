// Package calculator implements the arithmetic operations exposed by the API.
//
// It is deliberately free of any HTTP concerns so it can be tested and reused
// in isolation. Every operation validates its inputs and guarantees that a
// successful result is a finite float64.
package calculator

import (
	"errors"
	"fmt"
	"math"
	"sort"
)

// Operation identifies a supported arithmetic operation.
type Operation string

// Supported operations.
const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Sentinel errors returned by Calculate. Callers should match them with errors.Is.
var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrOperandCount     = errors.New("wrong number of operands")
	ErrInvalidOperand   = errors.New("operands must be finite numbers")
	ErrDivisionByZero   = errors.New("cannot divide by zero")
	ErrNegativeSqrt     = errors.New("cannot take the square root of a negative number")
	ErrUndefinedResult  = errors.New("result is undefined")
	ErrResultOutOfRange = errors.New("result is too large to represent")
)

// Info describes an operation for clients (e.g. GET /api/v1/operations).
type Info struct {
	Name        Operation `json:"name"`
	Arity       int       `json:"arity"`
	Description string    `json:"description"`
}

type definition struct {
	arity       int
	description string
	apply       func(operands []float64) (float64, error)
}

var definitions = map[Operation]definition{
	Add: {2, "a + b", func(o []float64) (float64, error) {
		return o[0] + o[1], nil
	}},
	Subtract: {2, "a - b", func(o []float64) (float64, error) {
		return o[0] - o[1], nil
	}},
	Multiply: {2, "a × b", func(o []float64) (float64, error) {
		return o[0] * o[1], nil
	}},
	Divide: {2, "a ÷ b", func(o []float64) (float64, error) {
		if o[1] == 0 {
			return 0, ErrDivisionByZero
		}
		return o[0] / o[1], nil
	}},
	Power: {2, "a raised to the power of b", func(o []float64) (float64, error) {
		// 0 raised to a negative power is 1/0.
		if o[0] == 0 && o[1] < 0 {
			return 0, ErrDivisionByZero
		}
		return math.Pow(o[0], o[1]), nil
	}},
	Sqrt: {1, "square root of a", func(o []float64) (float64, error) {
		if o[0] < 0 {
			return 0, ErrNegativeSqrt
		}
		return math.Sqrt(o[0]), nil
	}},
	Percentage: {2, "a percent of b (a / 100 × b)", func(o []float64) (float64, error) {
		return o[0] / 100 * o[1], nil
	}},
}

// Arity reports how many operands op takes, and whether op is supported.
func Arity(op Operation) (int, bool) {
	def, ok := definitions[op]
	return def.arity, ok
}

// Operations lists every supported operation, sorted by name.
func Operations() []Info {
	infos := make([]Info, 0, len(definitions))
	for name, def := range definitions {
		infos = append(infos, Info{Name: name, Arity: def.arity, Description: def.description})
	}
	sort.Slice(infos, func(i, j int) bool { return infos[i].Name < infos[j].Name })
	return infos
}

// Calculate applies op to operands.
//
// It returns an error wrapping one of the package's sentinel errors when the
// operation is unknown, the operand count is wrong, an operand is NaN or ±Inf,
// or the result is mathematically undefined or overflows float64.
func Calculate(op Operation, operands ...float64) (float64, error) {
	def, ok := definitions[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, op)
	}
	if len(operands) != def.arity {
		return 0, fmt.Errorf("%w: %s expects %d, got %d", ErrOperandCount, op, def.arity, len(operands))
	}
	for _, v := range operands {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, ErrInvalidOperand
		}
	}

	result, err := def.apply(operands)
	switch {
	case err != nil:
		return 0, err
	case math.IsNaN(result):
		// e.g. a negative base raised to a fractional power.
		return 0, ErrUndefinedResult
	case math.IsInf(result, 0):
		return 0, ErrResultOutOfRange
	case result == 0:
		// Normalise negative zero so clients never see "-0".
		return 0, nil
	}
	return result, nil
}
