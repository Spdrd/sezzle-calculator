/** Maximum number of digits a user may type into a single operand. */
export const MAX_INPUT_DIGITS = 15

/**
 * Formats an API result for display.
 *
 * Rounds to 12 significant digits so binary floating-point noise
 * (0.1 + 0.2 = 0.30000000000000004) is not shown, and lets very large or
 * small values fall back to exponential notation.
 */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Number.parseFloat(value.toPrecision(12))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** Formats a typed operand for the expression line (drops a trailing "."). */
export function formatOperand(input: string): string {
  return input.endsWith('.') ? input.slice(0, -1) : input
}
