import { useCallback, useRef, useState } from 'react'
import { calculate as defaultCalculate, CalculatorApiError } from '../api/client'
import { initialState, planKey, reducer, type Action, type CalculatorState, type Key } from './state'

export type CalculateFn = (operation: Parameters<typeof defaultCalculate>[0], operands: number[]) => Promise<number>

/**
 * Wires the pure calculator state machine to the backend API.
 *
 * Every key press goes into a FIFO queue drained by a single async loop, so
 * keys are always planned against the latest state, never a stale render, and
 * keys typed while a request is in flight are applied in order once it
 * settles. A failed request drops the rest of the queue so the error stays
 * visible.
 *
 * `calculate` is injectable so components can be tested without a server.
 */
export function useCalculator(calculate: CalculateFn = defaultCalculate) {
  const [state, setState] = useState<CalculatorState>(initialState)
  // Authoritative state, updated synchronously; `state` mirrors it for rendering.
  const current = useRef<CalculatorState>(initialState)
  const queue = useRef<Key[]>([])
  const draining = useRef(false)

  const apply = useCallback((action: Action) => {
    current.current = reducer(current.current, action)
    setState(current.current)
  }, [])

  const drain = useCallback(async () => {
    if (draining.current) return
    draining.current = true
    try {
      while (queue.current.length > 0) {
        const plan = planKey(current.current, queue.current.shift()!)
        if (plan === null) continue
        if (plan.type === 'action') {
          apply(plan.action)
          continue
        }

        apply({ type: 'request' })
        try {
          apply(plan.onSuccess(await calculate(plan.operation, plan.operands)))
        } catch (err) {
          queue.current = []
          const message =
            err instanceof CalculatorApiError ? err.message : 'Something went wrong. Please try again.'
          apply({ type: 'failure', message })
        }
      }
    } finally {
      draining.current = false
    }
  }, [apply, calculate])

  const press = useCallback(
    (key: Key) => {
      queue.current.push(key)
      void drain()
    },
    [drain],
  )

  return { state, press }
}
