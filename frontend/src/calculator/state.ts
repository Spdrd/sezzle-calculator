import { formatOperand, formatResult, MAX_INPUT_DIGITS } from './format'
import { OPERATIONS, type BinaryOperation, type Operation, type UnaryOperation } from './operations'

/**
 * Calculator state machine.
 *
 * All arithmetic happens on the backend, so this module only tracks what the
 * user has typed. `planKey` turns a key press into either a synchronous state
 * transition or an API request (plus the transition to apply on success),
 * which keeps every decision pure and unit-testable.
 */
export interface CalculatorState {
  /** The number currently shown/being typed. Always parseable by Number(). */
  input: string
  /** Left-hand operand of a pending binary operation. */
  stored: number | null
  /** Pending binary operation awaiting its right-hand operand. */
  operation: BinaryOperation | null
  /** Secondary display line, e.g. "12 + 3 =". */
  expression: string
  /** When true, the next digit starts a new number instead of appending. */
  overwrite: boolean
  /** True right after an operator is chosen, before any right-hand operand exists. */
  awaitingOperand: boolean
  /** Error message to show instead of the input. */
  error: string | null
  /** True while waiting for the API. */
  pending: boolean
}

export const initialState: CalculatorState = {
  input: '0',
  stored: null,
  operation: null,
  expression: '',
  overwrite: false,
  awaitingOperand: false,
  error: null,
  pending: false,
}

export type Key =
  | { kind: 'digit'; digit: string }
  | { kind: 'decimal' }
  | { kind: 'toggleSign' }
  | { kind: 'backspace' }
  | { kind: 'clear' }
  | { kind: 'equals' }
  | { kind: 'operation'; operation: Operation }

export type Action =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'setOperation'; operation: BinaryOperation }
  | { type: 'request' }
  | { type: 'evaluated'; result: number; expression: string }
  | { type: 'chained'; result: number; operation: BinaryOperation }
  | { type: 'unaryApplied'; result: number; expression: string }
  | { type: 'failure'; message: string }

export type Plan =
  | { type: 'action'; action: Action }
  | {
      type: 'request'
      operation: Operation
      operands: number[]
      onSuccess: (result: number) => Action
    }

const isBinary = (op: Operation): op is BinaryOperation => OPERATIONS[op].arity === 2

const countDigits = (input: string) => input.replace(/[^0-9]/g, '').length

/** Decides what a key press should do given the current state. Returns null for a no-op. */
export function planKey(state: CalculatorState, key: Key): Plan | null {
  if (state.pending) return null

  switch (key.kind) {
    case 'digit':
      return { type: 'action', action: { type: 'digit', digit: key.digit } }
    case 'decimal':
    case 'toggleSign':
    case 'backspace':
    case 'clear':
      return { type: 'action', action: { type: key.kind } }
    case 'equals':
      return planEquals(state)
    case 'operation':
      return isBinary(key.operation)
        ? planBinary(state, key.operation)
        : planUnary(state, key.operation)
  }
}

function planEquals(state: CalculatorState): Plan | null {
  const { stored, operation } = state
  if (state.error || operation === null || stored === null) return null

  const right = Number(state.input)
  const expression = `${formatResult(stored)} ${OPERATIONS[operation].symbol} ${formatOperand(state.input)} =`
  return {
    type: 'request',
    operation,
    operands: [stored, right],
    onSuccess: (result) => ({ type: 'evaluated', result, expression }),
  }
}

function planBinary(state: CalculatorState, next: BinaryOperation): Plan | null {
  if (state.error) return null

  // A complete "a op b" is pending: evaluate it first, then chain the new operator.
  if (state.operation !== null && state.stored !== null && !state.awaitingOperand) {
    return {
      type: 'request',
      operation: state.operation,
      operands: [state.stored, Number(state.input)],
      onSuccess: (result) => ({ type: 'chained', result, operation: next }),
    }
  }
  return { type: 'action', action: { type: 'setOperation', operation: next } }
}

function planUnary(state: CalculatorState, operation: UnaryOperation): Plan | null {
  if (state.error) return null

  const expression = `${OPERATIONS[operation].symbol}(${formatOperand(state.input)})`
  return {
    type: 'request',
    operation,
    operands: [Number(state.input)],
    onSuccess: (result) => ({ type: 'unaryApplied', result, expression }),
  }
}

export function reducer(state: CalculatorState, action: Action): CalculatorState {
  switch (action.type) {
    case 'clear':
      return initialState

    case 'digit': {
      if (!/^[0-9]$/.test(action.digit)) return state
      const base = state.error ? initialState : state
      if (base.overwrite) {
        return {
          ...base,
          input: action.digit,
          overwrite: false,
          awaitingOperand: false,
          // Typing after "=" starts a fresh calculation.
          expression: base.operation === null ? '' : base.expression,
        }
      }
      if (countDigits(base.input) >= MAX_INPUT_DIGITS) return base
      if (base.input === '0') return { ...base, input: action.digit }
      if (base.input === '-0') return { ...base, input: `-${action.digit}` }
      return { ...base, input: base.input + action.digit }
    }

    case 'decimal': {
      const base = state.error ? initialState : state
      if (base.overwrite) {
        return {
          ...base,
          input: '0.',
          overwrite: false,
          awaitingOperand: false,
          expression: base.operation === null ? '' : base.expression,
        }
      }
      if (base.input.includes('.')) return base
      return { ...base, input: `${base.input}.` }
    }

    case 'toggleSign': {
      if (state.error) return state
      const input = state.input.startsWith('-') ? state.input.slice(1) : `-${state.input}`
      return { ...state, input, overwrite: false, awaitingOperand: false }
    }

    case 'backspace': {
      if (state.error) return initialState
      if (state.overwrite) return state
      const input = state.input.slice(0, -1)
      return { ...state, input: input === '' || input === '-' ? '0' : input }
    }

    case 'setOperation': {
      // Switching operator right after choosing one keeps the stored operand.
      const stored =
        state.operation !== null && state.awaitingOperand && state.stored !== null
          ? state.stored
          : Number(state.input)
      return {
        ...state,
        stored,
        operation: action.operation,
        expression: `${formatResult(stored)} ${OPERATIONS[action.operation].symbol}`,
        input: formatResult(stored),
        overwrite: true,
        awaitingOperand: true,
      }
    }

    case 'request':
      return { ...state, pending: true }

    case 'evaluated':
      return {
        ...state,
        input: formatResult(action.result),
        stored: null,
        operation: null,
        expression: action.expression,
        overwrite: true,
        awaitingOperand: false,
        pending: false,
      }

    case 'chained': {
      const shown = formatResult(action.result)
      return {
        ...state,
        input: shown,
        stored: action.result,
        operation: action.operation,
        expression: `${shown} ${OPERATIONS[action.operation].symbol}`,
        overwrite: true,
        awaitingOperand: true,
        pending: false,
      }
    }

    case 'unaryApplied':
      return {
        ...state,
        input: formatResult(action.result),
        expression:
          state.operation !== null && state.stored !== null
            ? `${formatResult(state.stored)} ${OPERATIONS[state.operation].symbol} ${action.expression}`
            : `${action.expression} =`,
        overwrite: true,
        awaitingOperand: false,
        pending: false,
      }

    case 'failure':
      return { ...state, error: action.message, pending: false }
  }
}
