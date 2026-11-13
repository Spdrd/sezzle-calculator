import type { Operation } from '../calculator/operations'

/**
 * Base URL of the calculator API. Empty means "same origin", which works with
 * the Vite dev proxy and with the single-container Docker image.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? ''

/** An error reported by, or while talking to, the calculator API. */
export class CalculatorApiError extends Error {
  readonly code: string
  readonly status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'CalculatorApiError'
    this.code = code
    this.status = status
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown }
}

/** Calls POST /api/v1/{operation} and returns the numeric result. */
export async function calculate(
  operation: Operation,
  operands: number[],
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let response: Response
  try {
    response = await fetchImpl(`${API_BASE_URL}/api/v1/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operands }),
    })
  } catch {
    throw new CalculatorApiError('Unable to reach the calculator service.', 'network_error')
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (body as ErrorEnvelope | null)?.error
    const message =
      typeof error?.message === 'string' ? error.message : `Request failed (HTTP ${response.status}).`
    const code = typeof error?.code === 'string' ? error.code : 'http_error'
    throw new CalculatorApiError(capitalize(message), code, response.status)
  }

  const result = (body as { result?: unknown } | null)?.result
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new CalculatorApiError('The calculator service sent an invalid response.', 'invalid_response', response.status)
  }
  return result
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
