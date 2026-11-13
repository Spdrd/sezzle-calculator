import type { Key } from './state'

/** Maps a KeyboardEvent.key value to a calculator key, or null if unmapped. */
export function keyFromKeyboard(key: string): Key | null {
  if (/^[0-9]$/.test(key)) return { kind: 'digit', digit: key }
  switch (key) {
    case '.':
    case ',':
      return { kind: 'decimal' }
    case '+':
      return { kind: 'operation', operation: 'add' }
    case '-':
      return { kind: 'operation', operation: 'subtract' }
    case '*':
    case 'x':
      return { kind: 'operation', operation: 'multiply' }
    case '/':
      return { kind: 'operation', operation: 'divide' }
    case '^':
      return { kind: 'operation', operation: 'power' }
    case '%':
      return { kind: 'operation', operation: 'percentage' }
    case 'r':
      return { kind: 'operation', operation: 'sqrt' }
    case 'n':
      return { kind: 'toggleSign' }
    case '=':
    case 'Enter':
      return { kind: 'equals' }
    case 'Backspace':
      return { kind: 'backspace' }
    case 'Escape':
    case 'Delete':
      return { kind: 'clear' }
    default:
      return null
  }
}
