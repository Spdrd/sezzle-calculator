import { describe, expect, it } from 'vitest'
import { initialState, planKey, reducer, type CalculatorState, type Key, type Plan } from './state'

/** Applies a sequence of keys, resolving API requests with `resolve`. */
function run(keys: Key[], resolve: (op: string, operands: number[]) => number, start = initialState) {
  let state = start
  for (const key of keys) {
    const plan = planKey(state, key)
    if (!plan) continue
    if (plan.type === 'action') {
      state = reducer(state, plan.action)
    } else {
      state = reducer(state, { type: 'request' })
      state = reducer(state, plan.onSuccess(resolve(plan.operation, plan.operands)))
    }
  }
  return state
}

const localMath = (op: string, [a, b]: number[]) => {
  switch (op) {
    case 'add':
      return a + b
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      return a / b
    case 'power':
      return a ** b
    case 'percentage':
      return (a / 100) * b
    case 'sqrt':
      return Math.sqrt(a)
    default:
      throw new Error(op)
  }
}

const d = (digit: string): Key => ({ kind: 'digit', digit })
const digits = (s: string): Key[] => [...s].map((c) => (c === '.' ? { kind: 'decimal' } : d(c)))
const op = (operation: Extract<Key, { kind: 'operation' }>['operation']): Key => ({ kind: 'operation', operation })
const eq: Key = { kind: 'equals' }

describe('input entry', () => {
  it('replaces the leading zero and appends digits', () => {
    expect(run(digits('120'), localMath).input).toBe('120')
  })

  it('allows only one decimal point', () => {
    expect(run(digits('1.2.3'), localMath).input).toBe('1.23')
  })

  it('prefixes a bare decimal with zero', () => {
    expect(run(digits('.5'), localMath).input).toBe('0.5')
  })

  it('limits the number of digits', () => {
    expect(run(digits('1234567890123456789'), localMath).input).toBe('123456789012345')
  })

  it('ignores non-digit characters', () => {
    expect(reducer(initialState, { type: 'digit', digit: 'a' })).toBe(initialState)
  })

  it('toggles the sign and keeps typing', () => {
    const state = run([{ kind: 'toggleSign' }, ...digits('5')], localMath)
    expect(state.input).toBe('-5')
    expect(run([{ kind: 'toggleSign' }], localMath, state).input).toBe('5')
  })

  it('backspace removes the last character and falls back to 0', () => {
    expect(run([...digits('12'), { kind: 'backspace' }], localMath).input).toBe('1')
    expect(run([{ kind: 'toggleSign' }, d('7'), { kind: 'backspace' }], localMath).input).toBe('0')
  })

  it('backspace does not edit a computed result', () => {
    const state = run([d('2'), op('add'), d('3'), eq, { kind: 'backspace' }], localMath)
    expect(state.input).toBe('5')
  })

  it('clear resets everything', () => {
    expect(run([d('2'), op('add'), d('3'), { kind: 'clear' }], localMath)).toEqual(initialState)
  })
})

describe('binary operations', () => {
  it.each([
    ['add', '7', '5', '12'],
    ['subtract', '7', '5', '2'],
    ['multiply', '7', '5', '35'],
    ['divide', '7', '2', '3.5'],
    ['power', '2', '8', '256'],
    ['percentage', '15', '200', '30'],
  ] as const)('%s %s and %s = %s', (operation, a, b, expected) => {
    const state = run([...digits(a), op(operation), ...digits(b), eq], localMath)
    expect(state.input).toBe(expected)
    expect(state.operation).toBeNull()
    expect(state.expression).toMatch(/=$/)
  })

  it('sends the stored and typed operands to the API', () => {
    const state = run([...digits('12'), op('divide'), ...digits('4')], localMath)
    const plan = planKey(state, eq) as Extract<Plan, { type: 'request' }>
    expect(plan.type).toBe('request')
    expect(plan.operation).toBe('divide')
    expect(plan.operands).toEqual([12, 4])
  })

  it('shows the full expression after equals', () => {
    const state = run([...digits('12'), op('add'), ...digits('3.'), eq], localMath)
    expect(state.expression).toBe('12 + 3 =')
  })

  it('chains operations by evaluating the pending one first', () => {
    const state = run([d('2'), op('add'), d('3'), op('multiply')], localMath)
    expect(state.input).toBe('5')
    expect(state.stored).toBe(5)
    expect(state.operation).toBe('multiply')
    expect(state.expression).toBe('5 ×')
    expect(run([d('4'), eq], localMath, state).input).toBe('20')
  })

  it('switches operator when two are pressed in a row', () => {
    const state = run([d('9'), op('add'), op('subtract'), d('4'), eq], localMath)
    expect(state.input).toBe('5')
  })

  it('reuses the left operand when equals follows an operator', () => {
    expect(run([d('6'), op('add'), eq], localMath).input).toBe('12')
  })

  it('continues from a result when an operator follows equals', () => {
    expect(run([d('2'), op('add'), d('3'), eq, op('multiply'), d('2'), eq], localMath).input).toBe('10')
  })

  it('starts fresh when a digit follows equals', () => {
    const state = run([d('2'), op('add'), d('3'), eq, d('7')], localMath)
    expect(state.input).toBe('7')
    expect(state.expression).toBe('')
  })

  it('equals without a pending operation is a no-op', () => {
    expect(planKey(run(digits('42'), localMath), eq)).toBeNull()
  })

  it('formats floating point noise away', () => {
    expect(run([...digits('.1'), op('add'), ...digits('.2'), eq], localMath).input).toBe('0.3')
  })
})

describe('unary operations', () => {
  it('applies square root to the current input', () => {
    const state = run([...digits('16'), op('sqrt')], localMath)
    expect(state.input).toBe('4')
    expect(state.expression).toBe('√(16) =')
  })

  it('uses the square root as the right-hand operand of a pending operation', () => {
    const state = run([d('5'), op('add'), ...digits('16'), op('sqrt')], localMath)
    expect(state.expression).toBe('5 + √(16)')
    expect(run([eq], localMath, state).input).toBe('9')
  })

  it('chains a new operator after a square root operand', () => {
    const state = run([d('5'), op('add'), d('9'), op('sqrt'), op('multiply'), d('2'), eq], localMath)
    expect(state.input).toBe('16')
  })
})

describe('errors and pending requests', () => {
  const failed: CalculatorState = reducer(
    run([d('1'), op('divide'), d('0')], localMath),
    { type: 'failure', message: 'Cannot divide by zero' },
  )

  it('stores the error message', () => {
    expect(failed.error).toBe('Cannot divide by zero')
    expect(failed.pending).toBe(false)
  })

  it('ignores operators and equals while an error is shown', () => {
    expect(planKey(failed, op('add'))).toBeNull()
    expect(planKey(failed, op('sqrt'))).toBeNull()
    expect(planKey(failed, eq)).toBeNull()
    expect(reducer(failed, { type: 'toggleSign' })).toBe(failed)
  })

  it('starts over when typing after an error', () => {
    expect(run([d('8')], localMath, failed)).toMatchObject({ input: '8', error: null, operation: null })
    expect(run([{ kind: 'decimal' }], localMath, failed).input).toBe('0.')
    expect(run([{ kind: 'backspace' }], localMath, failed)).toEqual(initialState)
  })

  it('ignores every key while a request is pending', () => {
    const pending = reducer(initialState, { type: 'request' })
    expect(planKey(pending, d('1'))).toBeNull()
    expect(planKey(pending, { kind: 'clear' })).toBeNull()
  })
})
