---
name: calculator-add-operation
description: Flujo para añadir o modificar una operación de la calculadora en todos los componentes a la vez. Abarca el núcleo Go, el API, los tests, el keypad React, el atajo de teclado, la documentación y los diagramas. Úsala cuando pidan "añade la operación módulo, factorial, log, inverso...", "agrega un botón nuevo", "cambia cómo funciona el porcentaje", o cualquier cambio en el conjunto de operaciones. Add or change a calculator operation end to end.
---

# Añadir o modificar una operación

Las operaciones están definidas por datos en las dos capas. Casi todo se reduce a añadir una entrada en una tabla, pero hay varios puntos que se olvidan con facilidad. Sigue el orden de abajo.

## 0. Decide el contrato

- **Nombre en el API:** minúsculas, una palabra (`modulo`, `log`, `reciprocal`). Pasa a ser la ruta `POST /api/v1/{name}`.
- **Aridad:** 1 o 2. Los resultados de una operación de aridad 1 sustituyen al número visible, igual que `√`. Las de aridad 2 se encadenan como `+`.
- **Casos sin respuesta:** decide qué entradas no tienen resultado y con qué error. Reutiliza un centinela existente cuando encaje, por ejemplo `ErrDivisionByZero` para `x mod 0`. Si no encaja ninguno, crea uno nuevo (ver paso 2).

## 1. Núcleo Go: `backend/internal/calculator/calculator.go`

1. Añade la constante: `Modulo Operation = "modulo"`.
2. Añade una entrada al mapa `definitions` con `{arity, description, apply}`. La función `apply` valida el dominio y devuelve el centinela que corresponda.
3. `Calculate` ya cubre lo genérico, así que no hace falta repetirlo: aridad, operandos NaN o ±Inf, resultados NaN o ±Inf y normalización de `-0`.

## 2. Si creas un error centinela nuevo

1. Decláralo en el bloque `var (...)` de `calculator.go`. El mensaje va en minúsculas y sin punto final, porque el frontend pone la mayúscula.
2. Mapéalo en `classify()` de `backend/internal/api/handlers.go`. Usa 422 si la petición era válida pero la matemática no tiene respuesta, y 400 si la entrada estaba mal formada. El `code` va en snake_case.
3. Añade el caso a `TestClassify` en `router_test.go`.

## 3. Tests del backend

- **`calculator_test.go`:** añade casos de éxito a `TestCalculate` y casos de error a `TestCalculateErrors`.
- **`router_test.go`:**
  - Añade un caso a `TestCalculateSuccess` y, si procede, otro a `TestCalculateErrors`.
  - ⚠️ Actualiza el número esperado en `TestListOperations`. Ahora mismo compara con `7`.
- **`.claude/skills/calculator-api/scripts/smoke.py`:** añade las filas nuevas a `CASES`.

## 4. Frontend

1. **`frontend/src/calculator/operations.ts`:** añade la operación a `OPERATIONS` con `{ arity, symbol, label }`.
   - `symbol` se muestra en la línea de expresión. Las de aridad 1 se muestran como `symbol(x)`.
   - `label` se usa como `aria-label` del botón.
   - Los tipos `Operation`, `BinaryOperation` y `UnaryOperation` se derivan solos de la aridad.
2. **`frontend/src/components/Calculator.tsx`:** añade el botón a `BUTTONS` con `op('modulo', 'mod')`.
   - La rejilla tiene 4 columnas, así que reorganiza las filas para que el keypad siga cuadrando.
   - Usa `variant: 'function'` para las operaciones avanzadas.
3. **`frontend/src/calculator/keys.ts`:** asigna una tecla que no esté usada. Las teclas ocupadas son: dígitos, `. , + - * x / ^ % r n = Enter Backspace Escape Delete`.
4. **Pista en pantalla:** actualiza el texto de atajos en `frontend/src/App.tsx`.
5. **Tests del frontend:**
   - `format.test.ts`: la tecla nueva en `keyFromKeyboard`.
   - `state.test.ts`: un caso en `localMath` y un escenario con `run(...)`.
   - `Calculator.test.tsx`: un clic en el botón nuevo y el `calculate` simulado recibe `('modulo', [a, b])`.

`state.ts` y `useCalculator.ts` no necesitan cambios: tratan cualquier operación según su aridad.

## 5. Documentación

- **`README.md`:** la tabla de operaciones del API, un ejemplo de `curl`, la tabla de errores si hay un código nuevo, la lista de "Supported operations" y la sección "Using the UI".
- **`backend/class-diagram.drawio`:** la caja `Operation` (constantes) y, si hay centinela nuevo, la caja "errores centinela".
- **`frontend/class-diagram.drawio`:** la caja `Operation` (unión de strings).

Para editar los diagramas, busca el `mxCell` de la fila correspondiente en el XML y añade una fila hermana con el mismo estilo. Aumenta la altura (`height`) de la caja padre 20 px por cada fila nueva.

## 6. Verificación

1. Skill **calculator-tests**: comprobación rápida y luego `coverage_report.py`. La cobertura de `internal/calculator` tiene que seguir en el 100 %.
2. Skill **calculator-stack**: levantar backend y frontend.
3. Skill **calculator-api**: ejecutar `smoke.py` y la operación nueva con `calc.py`, incluidos sus casos de error.
4. Skill **calculator-ui**: teclear la operación con el atajo nuevo y con el botón, y comprobar el display y la expresión. Revisa también la vista móvil, porque el keypad cambió.
