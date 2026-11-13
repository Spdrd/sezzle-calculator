import { describe, expect, it } from 'vitest'
import { formatOperand, formatResult } from './format'
import { keyFromKeyboard } from './keys'

describe('formatResult', () => {
  it.each([
    [3, '3'],
    [0.1 + 0.2, '0.3'],
    [-0, '0'],
    [1 / 3, '0.333333333333'],
    [123456789.123, '123456789.123'],
    [1e21, '1e+21'],
    [2.5e-8, '2.5e-8'],
    [Number.POSITIVE_INFINITY, 'Error'],
    [Number.NaN, 'Error'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatResult(value)).toBe(expected)
  })
})

describe('formatOperand', () => {
  it('drops a trailing decimal point', () => {
    expect(formatOperand('3.')).toBe('3')
    expect(formatOperand('3.5')).toBe('3.5')
  })
})

describe('keyFromKeyboard', () => {
  it.each([
    ['7', { kind: 'digit', digit: '7' }],
    ['.', { kind: 'decimal' }],
    [',', { kind: 'decimal' }],
    ['+', { kind: 'operation', operation: 'add' }],
    ['-', { kind: 'operation', operation: 'subtract' }],
    ['*', { kind: 'operation', operation: 'multiply' }],
    ['x', { kind: 'operation', operation: 'multiply' }],
    ['/', { kind: 'operation', operation: 'divide' }],
    ['^', { kind: 'operation', operation: 'power' }],
    ['%', { kind: 'operation', operation: 'percentage' }],
    ['r', { kind: 'operation', operation: 'sqrt' }],
    ['n', { kind: 'toggleSign' }],
    ['Enter', { kind: 'equals' }],
    ['=', { kind: 'equals' }],
    ['Backspace', { kind: 'backspace' }],
    ['Escape', { kind: 'clear' }],
    ['Delete', { kind: 'clear' }],
  ])('maps %s', (key, expected) => {
    expect(keyFromKeyboard(key)).toEqual(expected)
  })

  it('returns null for unmapped keys', () => {
    expect(keyFromKeyboard('a')).toBeNull()
    expect(keyFromKeyboard('Tab')).toBeNull()
  })
})
