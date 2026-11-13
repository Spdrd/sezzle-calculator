package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
	}{
		{"add integers", Add, []float64{2, 3}, 5},
		{"add negatives", Add, []float64{-2.5, -0.5}, -3},
		{"subtract", Subtract, []float64{10, 4}, 6},
		{"subtract to negative", Subtract, []float64{4, 10}, -6},
		{"multiply", Multiply, []float64{6, 7}, 42},
		{"multiply by zero is positive zero", Multiply, []float64{-5, 0}, 0},
		{"divide", Divide, []float64{9, 3}, 3},
		{"divide fractional", Divide, []float64{1, 4}, 0.25},
		{"divide zero by number", Divide, []float64{0, 5}, 0},
		{"power", Power, []float64{2, 10}, 1024},
		{"power negative exponent", Power, []float64{2, -2}, 0.25},
		{"power fractional exponent", Power, []float64{9, 0.5}, 3},
		{"power zero to zero", Power, []float64{0, 0}, 1},
		{"power negative base integer exponent", Power, []float64{-2, 3}, -8},
		{"sqrt", Sqrt, []float64{16}, 4},
		{"sqrt zero", Sqrt, []float64{0}, 0},
		{"sqrt non-perfect", Sqrt, []float64{2}, math.Sqrt2},
		{"percentage", Percentage, []float64{15, 200}, 30},
		{"percentage over 100", Percentage, []float64{150, 40}, 60},
		{"percentage of negative", Percentage, []float64{50, -10}, -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands...)
			if err != nil {
				t.Fatalf("Calculate(%s, %v) unexpected error: %v", tt.op, tt.operands, err)
			}
			if got != tt.want {
				t.Errorf("Calculate(%s, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
			if got == 0 && math.Signbit(got) {
				t.Errorf("Calculate(%s, %v) returned negative zero", tt.op, tt.operands)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		wantErr  error
	}{
		{"unknown operation", Operation("modulo"), []float64{1, 2}, ErrUnknownOperation},
		{"too few operands", Add, []float64{1}, ErrOperandCount},
		{"too many operands", Add, []float64{1, 2, 3}, ErrOperandCount},
		{"no operands", Sqrt, nil, ErrOperandCount},
		{"binary operands for unary op", Sqrt, []float64{4, 2}, ErrOperandCount},
		{"NaN operand", Add, []float64{math.NaN(), 1}, ErrInvalidOperand},
		{"infinite operand", Multiply, []float64{math.Inf(1), 1}, ErrInvalidOperand},
		{"division by zero", Divide, []float64{1, 0}, ErrDivisionByZero},
		{"zero divided by zero", Divide, []float64{0, 0}, ErrDivisionByZero},
		{"zero to negative power", Power, []float64{0, -1}, ErrDivisionByZero},
		{"negative base fractional exponent", Power, []float64{-8, 1.0 / 3}, ErrUndefinedResult},
		{"power overflow", Power, []float64{10, 400}, ErrResultOutOfRange},
		{"multiply overflow", Multiply, []float64{math.MaxFloat64, 2}, ErrResultOutOfRange},
		{"add overflow", Add, []float64{math.MaxFloat64, math.MaxFloat64}, ErrResultOutOfRange},
		{"divide overflow", Divide, []float64{math.MaxFloat64, 0.5}, ErrResultOutOfRange},
		{"negative sqrt", Sqrt, []float64{-1}, ErrNegativeSqrt},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands...)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Calculate(%s, %v) error = %v, want %v", tt.op, tt.operands, err, tt.wantErr)
			}
			if got != 0 {
				t.Errorf("Calculate(%s, %v) returned %v alongside an error, want 0", tt.op, tt.operands, got)
			}
		})
	}
}

func TestArity(t *testing.T) {
	if n, ok := Arity(Sqrt); !ok || n != 1 {
		t.Errorf("Arity(sqrt) = %d, %v; want 1, true", n, ok)
	}
	if n, ok := Arity(Add); !ok || n != 2 {
		t.Errorf("Arity(add) = %d, %v; want 2, true", n, ok)
	}
	if _, ok := Arity("nope"); ok {
		t.Error("Arity(nope) reported ok for an unknown operation")
	}
}

func TestOperationsIsSortedAndComplete(t *testing.T) {
	ops := Operations()
	if len(ops) != len(definitions) {
		t.Fatalf("Operations() returned %d entries, want %d", len(ops), len(definitions))
	}
	for i := 1; i < len(ops); i++ {
		if ops[i-1].Name >= ops[i].Name {
			t.Errorf("Operations() not sorted: %q before %q", ops[i-1].Name, ops[i].Name)
		}
	}
	for _, info := range ops {
		if info.Description == "" {
			t.Errorf("operation %q has no description", info.Name)
		}
	}
}
