/** Operations supported by the backend, keyed by their API name. */
export const OPERATIONS = {
  add: { arity: 2, symbol: '+', label: 'Add' },
  subtract: { arity: 2, symbol: '−', label: 'Subtract' },
  multiply: { arity: 2, symbol: '×', label: 'Multiply' },
  divide: { arity: 2, symbol: '÷', label: 'Divide' },
  power: { arity: 2, symbol: '^', label: 'Power' },
  percentage: { arity: 2, symbol: '% of', label: 'Percent of' },
  sqrt: { arity: 1, symbol: '√', label: 'Square root' },
} as const

export type Operation = keyof typeof OPERATIONS

export type BinaryOperation = {
  [K in Operation]: (typeof OPERATIONS)[K]['arity'] extends 2 ? K : never
}[Operation]

export type UnaryOperation = Exclude<Operation, BinaryOperation>
