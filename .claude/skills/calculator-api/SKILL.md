---
name: calculator-api
description: Interactúa con el backend Go (REST API) de la calculadora. Sirve para comprobar el health check, listar operaciones, calcular (add, subtract, multiply, divide, power, sqrt, percentage), probar casos límite y validar el contrato de errores. Úsala cuando pidan "llamar a la API", "probar el backend", "¿qué devuelve /api/v1/...?", hacer un smoke test del API, o verificar un cambio en backend/internal/api o backend/internal/calculator. Call, test or smoke-test the calculator REST API.
---

# Interactuar con la API de la calculadora

El backend vive en `backend/`. Expone JSON en `http://localhost:8080` por defecto. En el contenedor Docker usa el puerto que se haya mapeado.

## 1. Asegúrate de que el backend está corriendo

```bash
python .claude/skills/calculator-api/scripts/calc.py health
```

Si falla con `connection error`, arráncalo con la skill **calculator-stack**. La vía preferida en la app de escritorio es `preview_start` con el nombre `backend`. También puedes ejecutar `go -C backend run .` en segundo plano.

## 2. Hacer llamadas

Usa el script incluido, que solo necesita la biblioteca estándar de Python, en lugar de construir `curl` a mano:

```bash
python .claude/skills/calculator-api/scripts/calc.py ops              # GET /api/v1/operations
python .claude/skills/calculator-api/scripts/calc.py add 2 3          # POST /api/v1/add {"operands":[2,3]}
python .claude/skills/calculator-api/scripts/calc.py sqrt 81
python .claude/skills/calculator-api/scripts/calc.py divide 1 0       # error 422 division_by_zero
python .claude/skills/calculator-api/scripts/calc.py subtract -5 -2   # los negativos funcionan
python .claude/skills/calculator-api/scripts/calc.py raw add '{"operands":[null,2]}'   # cuerpo arbitrario
python .claude/skills/calculator-api/scripts/calc.py --base http://localhost:18080 add 1 1
```

- Imprime el código HTTP y el JSON de respuesta.
- Códigos de salida: `0` si la respuesta es 2xx, `1` si el API devolvió un error y `2` si hubo un error de conexión o de uso.
- La URL base se toma de `--base`, después de la variable `CALC_API_URL` y, si ninguna está definida, de `http://localhost:8080`.

## 3. Smoke test completo

```bash
python .claude/skills/calculator-api/scripts/smoke.py [--base URL]
```

Ejecuta todas las operaciones y los casos límite documentados en el README: división por cero, raíz negativa, overflow, `null`, JSON inválido, cuerpo de más de 1 KiB, operación desconocida, etc. Imprime una tabla PASS/FAIL y sale con un código distinto de cero si algo falla. Ejecútalo después de cualquier cambio en el backend.

## Contrato del API (resumen)

| Método y ruta | Cuerpo | Respuesta 200 |
|---|---|---|
| `GET /api/health` | - | `{"status":"ok"}` |
| `GET /api/v1/operations` | - | `{"operations":[{"name","arity","description"}]}` |
| `POST /api/v1/{operation}` | `{"operands":[...]}` | `{"operation","operands","result"}` |

- Aridad: `sqrt` recibe 1 operando y el resto reciben 2.
- `percentage` calcula `a / 100 × b`, es decir, "a por ciento de b".

Todos los errores usan el mismo sobre: `{"error":{"code","message"}}`.

| Código HTTP | Códigos de error |
|---|---|
| 400 | `invalid_json`, `invalid_operand`, `invalid_operand_count` |
| 404 | `unknown_operation`, `not_found` |
| 413 | `body_too_large` |
| 422 | `division_by_zero`, `negative_sqrt`, `undefined_result`, `result_out_of_range` |
| 500 | `internal_error` |

La tabla detallada está en `README.md` → *API*. El mapeo de errores a códigos está en `classify()` de `backend/internal/api/handlers.go`.

## Al informar resultados

Cita el código HTTP y el JSON tal como los devuelve el servidor. Si un resultado no coincide con el contrato, señala el archivo responsable: `calculator.go` para la matemática y `handlers.go` para la validación y el mapeo de errores.
