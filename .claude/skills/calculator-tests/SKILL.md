---
name: calculator-tests
description: Ejecuta los tests unitarios y la cobertura de los componentes de la calculadora (paquetes Go calculator y api, y el frontend React con Vitest) y regenera docs/coverage.md. Úsala cuando pidan "corre los tests", "¿pasa todo?", "actualiza la cobertura", "genera el reporte de coverage", o antes de dar por terminado cualquier cambio en backend/ o frontend/. Run tests, lint and coverage for backend and frontend.
---

# Tests y cobertura

## Comprobación rápida (después de cualquier cambio)

Ejecuta los comandos con Bash, porque PowerShell parte en dos los argumentos que llevan `=`.

```bash
# Backend
cd backend && gofmt -l . && go vet ./... && go test ./...
```

```bash
# Frontend
cd frontend && npm test && npm run lint && npx tsc -b
```

- `gofmt -l .` no debe imprimir nada. Si lista archivos, corrígelos con `gofmt -w .`.
- `npx tsc -b` comprueba los tipos de todo el proyecto, incluidos los tests.

## Cobertura y reporte

```bash
python .claude/skills/calculator-tests/scripts/coverage_report.py
```

El script ejecuta las dos suites con cobertura y hace lo siguiente:

- Reescribe `docs/coverage.md` con el resumen por función de Go y la tabla por archivo de Vitest.
- Deja reportes HTML en `backend/coverage.html` y en `frontend/coverage/index.html`. Los dos están en `.gitignore`.
- Imprime un resumen. Sale con código distinto de cero si algún test falla.

Si las cifras cambian, actualiza también la tabla "Current coverage" de `README.md`.

## Dónde está cada test

| Componente | Archivo de test | Qué cubre |
|---|---|---|
| `internal/calculator` | `calculator_test.go` | Operaciones y errores centinela, en tablas de casos. Llega al 100 %. |
| `internal/api` | `router_test.go` | Rutas, validación JSON, códigos HTTP, CORS, recuperación de panics, SPA y `classify`. |
| `state.ts` | `state.test.ts` | Máquina de estados pura: entrada, encadenado, unarios y errores. |
| `format.ts` y `keys.ts` | `format.test.ts` | Formato de resultados y mapa de teclado. |
| `client.ts` | `client.test.ts` | Peticiones `fetch` simuladas: éxito, error del API, red y respuesta inválida. |
| `<Calculator />` | `Calculator.test.tsx` | Interacción con Testing Library: teclado, botones, cola de teclas, errores y estado ocupado. |

## Convenciones al añadir tests

- **Go:** tests de tabla con `t.Run`. Compara errores con `errors.Is` contra los centinelas, nunca por texto.
- **Frontend:** la lógica nueva va en `state.ts` con tests puros usando el helper `run(keys, localMath)`. En los tests de componente inyecta `calculate` con `vi.fn()` en lugar de llamar a un servidor real.
- `main.go` no lleva tests unitarios a propósito, porque solo conecta piezas. Por eso el total de Go aparece en torno al 84 %.

## Al informar

Da el número de tests que pasaron y fallaron y el porcentaje por paquete o archivo. Si algo falla, copia la salida del fallo sin resumirla.
