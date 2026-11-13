import { describe, expect, it, vi } from 'vitest'
import { calculate, CalculatorApiError } from './client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('calculate', () => {
  it('posts the operands and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { operation: 'add', operands: [2, 3], result: 5 }))

    await expect(calculate('add', [2, 3], fetchMock)).resolves.toBe(5)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operands: [2, 3] }),
    })
  })

  it('surfaces the API error message and code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: { code: 'division_by_zero', message: 'cannot divide by zero' } }))

    const error = await calculate('divide', [1, 0], fetchMock).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CalculatorApiError)
    expect(error).toMatchObject({ message: 'Cannot divide by zero', code: 'division_by_zero', status: 422 })
  })

  it('falls back to a generic message for non-JSON error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }))

    await expect(calculate('add', [1, 1], fetchMock)).rejects.toMatchObject({
      message: 'Request failed (HTTP 502).',
      code: 'http_error',
      status: 502,
    })
  })

  it('reports network failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(calculate('add', [1, 1], fetchMock)).rejects.toMatchObject({
      code: 'network_error',
      message: 'Unable to reach the calculator service.',
    })
  })

  it('rejects a success response without a numeric result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: 'five' }))

    await expect(calculate('add', [2, 3], fetchMock)).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
