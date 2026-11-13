# Coverage report

Generated 2026-11-13 by `.claude/skills/calculator-tests/scripts/coverage_report.py`.

## Backend (`go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out`)

```
github.com/Spdrd/sezzle-calculator/backend		coverage: 0.0% of statements
ok  	github.com/Spdrd/sezzle-calculator/backend/internal/api	2.780s	coverage: 98.0% of statements
ok  	github.com/Spdrd/sezzle-calculator/backend/internal/calculator	1.142s	coverage: 100.0% of statements

internal/api/handlers.go:24:			values			100.0%
internal/api/handlers.go:53:			handleHealth		100.0%
internal/api/handlers.go:57:			handleListOperations	100.0%
internal/api/handlers.go:61:			handleCalculate		100.0%
internal/api/handlers.go:93:			decodeJSON		100.0%
internal/api/handlers.go:121:		classify		100.0%
internal/api/handlers.go:142:		writeJSON		100.0%
internal/api/handlers.go:148:		writeError		100.0%
internal/api/middleware.go:12:		withCORS		91.7%
internal/api/middleware.go:35:		WriteHeader		100.0%
internal/api/middleware.go:40:		withLogging		100.0%
internal/api/middleware.go:54:		withRecovery		100.0%
internal/api/middleware.go:68:		spaHandler		100.0%
internal/api/router.go:21:			NewRouter		93.8%
internal/calculator/calculator.go:88:	Arity			100.0%
internal/calculator/calculator.go:94:	Operations		100.0%
internal/calculator/calculator.go:108:	Calculate		100.0%
main.go:23:					main			0.0%
main.go:65:					envOr			0.0%
total:											(statements)		83.6%
```

`main.go` is process wiring (env config, signal handling) and is intentionally not unit tested.

## Frontend (`npm run coverage`)

```
 Test Files  5 passed (5)
      Tests  77 passed (77)
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |    96.98 |     100 |     100 |                   
 src               |     100 |      100 |     100 |     100 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
 src/api           |     100 |      100 |     100 |     100 |                   
  client.ts        |     100 |      100 |     100 |     100 |                   
 src/calculator    |     100 |    97.58 |     100 |     100 |                   
  format.ts        |     100 |     87.5 |     100 |     100 | 14                
  keys.ts          |     100 |      100 |     100 |     100 |                   
  operations.ts    |     100 |      100 |     100 |     100 |                   
  state.ts         |     100 |    98.76 |     100 |     100 | 171               
  useCalculator.ts |     100 |    93.33 |     100 |     100 | 36                
 src/components    |     100 |     91.3 |     100 |     100 |                   
  Calculator.tsx   |     100 |     91.3 |     100 |     100 | 61-63             
-------------------|---------|----------|---------|---------|-------------------
```
