import { useEffect } from 'react'
import { keyFromKeyboard } from '../calculator/keys'
import { OPERATIONS } from '../calculator/operations'
import type { Key } from '../calculator/state'
import { useCalculator, type CalculateFn } from '../calculator/useCalculator'
import './Calculator.css'

interface ButtonSpec {
  label: string
  key: Key
  ariaLabel: string
  variant?: 'operator' | 'function' | 'equals'
  wide?: boolean
}

const digit = (d: string): ButtonSpec => ({ label: d, key: { kind: 'digit', digit: d }, ariaLabel: d })

const op = (operation: keyof typeof OPERATIONS, label: string): ButtonSpec => ({
  label,
  key: { kind: 'operation', operation },
  ariaLabel: OPERATIONS[operation].label,
  variant: 'operator',
})

// Laid out row by row on a 4-column grid.
const BUTTONS: ButtonSpec[] = [
  { label: 'AC', key: { kind: 'clear' }, ariaLabel: 'Clear', variant: 'function' },
  { label: '⌫', key: { kind: 'backspace' }, ariaLabel: 'Backspace', variant: 'function' },
  { ...op('sqrt', '√x'), variant: 'function' },
  op('divide', '÷'),
  { ...op('power', 'xʸ'), variant: 'function' },
  { ...op('percentage', '% of'), variant: 'function' },
  { label: '±', key: { kind: 'toggleSign' }, ariaLabel: 'Toggle sign', variant: 'function' },
  op('multiply', '×'),
  digit('7'),
  digit('8'),
  digit('9'),
  op('subtract', '−'),
  digit('4'),
  digit('5'),
  digit('6'),
  op('add', '+'),
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '=', key: { kind: 'equals' }, ariaLabel: 'Equals', variant: 'equals' },
  { ...digit('0'), wide: true },
  { label: '.', key: { kind: 'decimal' }, ariaLabel: 'Decimal point' },
]

interface CalculatorProps {
  /** Override the API call (used by tests). */
  calculate?: CalculateFn
}

export function Calculator({ calculate }: CalculatorProps) {
  const { state, press } = useCalculator(calculate)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = keyFromKeyboard(event.key)
      if (key === null) return
      event.preventDefault()
      void press(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press])

  const main = state.error ?? state.input

  return (
    <section className="calculator" aria-label="Calculator" aria-busy={state.pending}>
      <div className="display">
        <div className="expression" data-testid="expression">
          {state.expression || ' '}
        </div>
        <output
          className={`value${state.error ? ' value--error' : ''}${main.length > 12 ? ' value--long' : ''}`}
          aria-live="polite"
          role={state.error ? 'alert' : 'status'}
          data-testid="display"
        >
          {main}
        </output>
      </div>

      <div className="keypad">
        {BUTTONS.map((button) => (
          <button
            key={button.ariaLabel}
            type="button"
            className={[
              'key',
              button.variant && `key--${button.variant}`,
              button.wide && 'key--wide',
              button.key.kind === 'operation' &&
                button.key.operation === state.operation &&
                state.awaitingOperand &&
                'key--active',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={button.ariaLabel}
            disabled={state.pending}
            onClick={() => void press(button.key)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </section>
  )
}
