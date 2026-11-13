---
name: calculator-ui
description: Interactúa con el componente React <Calculator /> en el navegador integrado. Sirve para pulsar teclas o botones, introducir expresiones, leer el display y la línea de expresión, comprobar los errores mostrados, el operador resaltado y el estado ocupado, y revisar la vista móvil. Úsala cuando pidan "probar la calculadora en el navegador", "verificar la UI", "pulsa 2 + 3 =", "¿qué muestra la pantalla?", o cuando haya que confirmar visualmente un cambio en frontend/src. Drive and inspect the calculator UI in the browser pane.
---

# Interactuar con la UI de la calculadora

## 1. Arranque

Hacen falta el frontend (Vite, puerto 5173) y el backend (puerto 8080). Vite reenvía `/api` al backend. Arráncalos con la skill **calculator-stack**, que llama a `preview_start` con los nombres `backend` y `frontend` definidos en `.claude/launch.json`. Después abre `http://localhost:5173` en el navegador integrado.

Con la imagen de Docker, la UI y el API se sirven juntos en el puerto que se haya mapeado, por ejemplo `http://localhost:8080`.

## 2. Mapa del componente

**Display.** Lee siempre por estos selectores y no por posición en pantalla.

| Elemento | Selector | Contenido |
|---|---|---|
| Línea de expresión | `[data-testid="expression"]` | Por ejemplo `12 + 3 =` o `5 ×`. Muestra un NBSP cuando está vacía. |
| Valor principal | `[data-testid="display"]` (`<output>`) | El número que se teclea, el resultado o el mensaje de error. |
| Error | `[role="alert"]` | Solo existe cuando hay error. Si no hay error, el display tiene `role="status"`. |
| Contenedor | `section[aria-label="Calculator"]` | `aria-busy="true"` mientras hay una petición al API en curso. |
| Operador pendiente | `button.key--active` | El operador elegido mientras espera el segundo operando. |

**Botones.** Búscalos con `find` o `read_page` por su `aria-label`:

`0`–`9`, `Decimal point`, `Clear` (AC), `Backspace` (⌫), `Toggle sign` (±), `Add`, `Subtract`, `Multiply`, `Divide`, `Power` (xʸ), `Percent of` (% of), `Square root` (√x), `Equals`.

**Teclado.** El listener está en `window` y la tabla vive en `frontend/src/calculator/keys.ts`.

| Tecla | Acción | Tecla | Acción |
|---|---|---|---|
| `0`–`9` | dígito | `.` o `,` | punto decimal |
| `+` `-` `*` (o `x`) `/` | operadores básicos | `^` | potencia |
| `%` | "a % de b" | `r` | raíz cuadrada |
| `n` | cambio de signo | `Enter` o `=` | igual |
| `Backspace` | borrar un carácter | `Escape` o `Delete` | AC |

## 3. Conducir la UI (forma preferida)

Ejecuta esto con `javascript_tool` en la pestaña de la calculadora. Envía las teclas, espera a que se vacíe la cola de peticiones y devuelve el estado visible:

```js
const read = () => ({
  expression: document.querySelector('[data-testid=expression]').textContent.trim(),
  display: document.querySelector('[data-testid=display]').textContent,
  error: document.querySelector('[role=alert]')?.textContent ?? null,
  activeOperator: document.querySelector('.key--active')?.getAttribute('aria-label') ?? null,
});
const busy = () => document.querySelector('section[aria-label=Calculator]').getAttribute('aria-busy') === 'true';
const type = async (keys) => {
  for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  // The hook replays queued keys one request at a time: wait until idle twice in a row.
  for (let idle = 0, i = 0; idle < 2 && i < 100; i++) {
    await new Promise((r) => setTimeout(r, 60));
    idle = busy() ? 0 : idle + 1;
  }
  return read();
};
({
  suma: await type(['Escape', '1', '2', '+', '3', 'Enter']),            // 12 + 3 = 15
  encadenado: await type(['Escape', '2', '+', '3', '*', '4', 'Enter']), // (2 + 3) × 4 = 20
  divCero: await type(['Escape', '1', '/', '0', 'Enter']),              // "Cannot divide by zero"
})
```

- Empieza cada escenario con `Escape` para partir del estado inicial.
- Las teclas se pueden enviar seguidas sin esperar. El hook `useCalculator` las encola y las aplica en orden.
- Si una petición falla, la cola se descarta y el error queda visible. Es el comportamiento esperado.

Para probar con el ratón, usa `computer` con `left_click` y el `ref` que devuelva `find("Add")`. Comprueba el resultado con `read_page` o con el snippet anterior, no a ojo.

## 4. Comportamiento esperado (para validar)

- `2 + 3 ×` evalúa lo pendiente: el display muestra `5` y la expresión `5 ×`.
- Pulsar dos operadores seguidos solo cambia el operador.
- `6 + =` usa el mismo número como segundo operando y da `12`.
- `√` se aplica al número visible en ese momento.
  - Sin operación pendiente, `16 r` da `4` y la expresión `√(16) =`.
  - Con una suma pendiente, `5 + 16 r` muestra la expresión `5 + √(16)`, y al pulsar `=` el resultado es `9`.
- `15 % 200 =` da `30`.
- Los resultados se redondean a 12 cifras significativas: `.1 + .2 =` muestra `0.3`.
- Si después de un error se teclea un dígito, la calculadora empieza de cero.
- Se aceptan como máximo 15 dígitos por operando.

## 5. Vista móvil y temas

- Usa `resize_window` con `preset: "mobile"`, recarga la página y haz una captura. Cuando termines, vuelve con `preset: "desktop"`.
- Para el tema oscuro usa `resize_window` con `colorScheme: "dark"`. Los colores son variables CSS definidas en `frontend/src/index.css`.

## 6. Al informar

Indica las teclas enviadas y lo que muestran `expression` y `display`. Si algo no cuadra, distingue dónde está el fallo:

- `frontend/src/calculator/state.ts`: la lógica de teclas.
- `frontend/src/api/client.ts`: los mensajes de error.
- El backend: los resultados numéricos. Contrasta con la skill **calculator-api**.
