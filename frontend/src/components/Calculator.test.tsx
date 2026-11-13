import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalculatorApiError } from '../api/client'
import { Calculator } from './Calculator'

const display = () => screen.getByTestId('display')
const expression = () => screen.getByTestId('expression')

function setup(calculate = vi.fn().mockResolvedValue(0)) {
  const user = userEvent.setup()
  render(<Calculator calculate={calculate} />)
  const click = async (...labels: string[]) => {
    for (const label of labels) await user.click(screen.getByRole('button', { name: label }))
  }
  return { user, click, calculate }
}

describe('<Calculator />', () => {
  it('starts at zero', () => {
    setup()
    expect(display()).toHaveTextContent('0')
  })

  it('evaluates an expression entered with the keypad', async () => {
    const { click, calculate } = setup(vi.fn().mockResolvedValue(42))

    await click('6', 'Multiply', '7', 'Equals')

    expect(calculate).toHaveBeenCalledWith('multiply', [6, 7])
    expect(display()).toHaveTextContent('42')
    expect(expression()).toHaveTextContent('6 × 7 =')
  })

  it('supports keyboard input', async () => {
    const { user, calculate } = setup(vi.fn().mockResolvedValue(3))

    await user.keyboard('1.5+1.5{Enter}')

    expect(calculate).toHaveBeenCalledWith('add', [1.5, 1.5])
    expect(display()).toHaveTextContent('3')
  })

  it('applies square root immediately', async () => {
    const { click, calculate } = setup(vi.fn().mockResolvedValue(5))

    await click('2', '5', 'Square root')

    expect(calculate).toHaveBeenCalledWith('sqrt', [25])
    expect(display()).toHaveTextContent('5')
  })

  it('shows API errors and recovers on the next digit', async () => {
    const calculate = vi
      .fn()
      .mockRejectedValue(new CalculatorApiError('Cannot divide by zero', 'division_by_zero', 422))
    const { click } = setup(calculate)

    await click('8', 'Divide', '0', 'Equals')

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot divide by zero')

    await click('3')
    expect(display()).toHaveTextContent('3')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a generic message for unexpected failures', async () => {
    const { click } = setup(vi.fn().mockRejectedValue(new Error('boom')))

    await click('4', 'Square root')

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('disables the keypad while a request is in flight', async () => {
    let resolve!: (value: number) => void
    const calculate = vi.fn(() => new Promise<number>((r) => (resolve = r)))
    const { click } = setup(calculate)

    await click('9', 'Square root')

    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
    expect(screen.getByLabelText('Calculator')).toHaveAttribute('aria-busy', 'true')

    await act(async () => resolve(3))

    expect(screen.getByRole('button', { name: '1' })).toBeEnabled()
    expect(display()).toHaveTextContent('3')
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it('queues keys typed while a request is in flight', async () => {
    const pending: Array<() => void> = []
    const results: Record<string, number> = { add: 5, multiply: 20 }
    const calculate = vi.fn(
      (operation: string) => new Promise<number>((resolve) => pending.push(() => resolve(results[operation]))),
    )
    const { user } = setup(calculate)

    await user.keyboard('2+3*') // "*" triggers 2 + 3, which stays pending
    await user.keyboard('4{Enter}') // typed before the first request resolves

    await act(async () => pending.shift()!())
    expect(calculate).toHaveBeenLastCalledWith('multiply', [5, 4])

    await act(async () => pending.shift()!())
    expect(display()).toHaveTextContent('20')
    expect(expression()).toHaveTextContent('5 × 4 =')
  })

  it('handles keys dispatched faster than React renders', async () => {
    const calculate = vi.fn((op: string, [a, b]: number[]) => Promise.resolve(op === 'add' ? a + b : a * b))
    setup(calculate)

    await act(async () => {
      for (const key of ['1', '2', '+', '3', '*', '2', 'Enter', 'Escape', '7']) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }))
      }
    })

    expect(calculate).toHaveBeenNthCalledWith(1, 'add', [12, 3])
    expect(calculate).toHaveBeenNthCalledWith(2, 'multiply', [15, 2])
    expect(display()).toHaveTextContent(/^7$/)
  })

  it('drops queued keys when a request fails', async () => {
    let reject!: (e: Error) => void
    const calculate = vi.fn(() => new Promise<number>((_, r) => (reject = r)))
    const { user } = setup(calculate)

    await user.keyboard('9r12')
    await act(async () => reject(new CalculatorApiError('Boom', 'x')))

    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it('highlights the selected operator until the next operand is typed', async () => {
    const { click } = setup()

    await click('2', 'Add')
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('key--active')

    await click('3')
    expect(screen.getByRole('button', { name: 'Add' })).not.toHaveClass('key--active')
  })

  it('clears with Escape', async () => {
    const { user } = setup()

    await user.keyboard('123{Escape}')

    expect(display()).toHaveTextContent('0')
  })
})
