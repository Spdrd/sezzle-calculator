---
name: calculator-stack
description: Arranca, comprueba y detiene los componentes de la calculadora. Cubre el backend Go (:8080), el frontend Vite (:5173) o la imagen Docker que sirve ambos. Úsala cuando pidan "levanta el proyecto", "arranca el backend o el frontend", "corre la app", "prueba la imagen Docker", "¿está corriendo?", o como paso previo de las skills calculator-api y calculator-ui. Start, check or stop the backend, frontend or Docker container.
---

# Levantar los componentes de la calculadora

| Componente | Cómo se ejecuta | Puerto | Health check |
|---|---|---|---|
| Backend (Go) | `go -C backend run .` | 8080 (`PORT`) | `GET /api/health` → `{"status":"ok"}` |
| Frontend (Vite) | `npm --prefix frontend run dev` | 5173 | La página carga y `/api/health` responde a través del proxy |
| Docker (los dos) | `docker run -p 8080:8080 sezzle-calculator` | 8080 | Los mismos dos endpoints en el mismo origen |

## Desarrollo (forma preferida en la app de escritorio)

`.claude/launch.json` define las configuraciones `backend` y `frontend`. Arráncalas con la herramienta `preview_start`, primero el backend:

1. `preview_start` con `name: "backend"`. La configuración tiene `autoPort: false` porque el proxy de Vite apunta fijo a 8080. Si el puerto está ocupado, averigua qué proceso lo tiene con `netstat -ano | findstr :8080` y pregunta al usuario antes de matarlo.
2. `preview_start` con `name: "frontend"`. Esto abre la pestaña en `http://localhost:5173`.
3. Verifica que todo responde:
   ```bash
   python .claude/skills/calculator-api/scripts/calc.py health
   python .claude/skills/calculator-api/scripts/calc.py --base http://localhost:5173 health
   ```
   El segundo comando pasa por el proxy de Vite.

Para ver los logs usa `preview_logs` con el `serverId`. Para parar los servidores usa `preview_stop`. Detén siempre los servidores que hayas arrancado tú antes de terminar.

Fuera de la app de escritorio, lanza esos dos comandos en segundo plano (`run_in_background`) y espera a que los health checks respondan.

## Docker (stack completo en un contenedor)

```bash
docker build -t sezzle-calculator .
docker run -d --rm --name sezzle-calc -p 18080:8080 sezzle-calculator
python .claude/skills/calculator-api/scripts/smoke.py --base http://localhost:18080
curl -s localhost:18080/ | grep -o '<title>.*</title>'      # <title>Calculator</title>
docker stop sezzle-calc
```

- Usa un puerto del host libre, por ejemplo 18080, para no chocar con un backend de desarrollo.
- La imagen pone `CORS_ORIGIN=""` y sirve el SPA desde `STATIC_DIR=/app/public`.
- La imagen final es distroless y no incluye `curl` ni shell. Compruébala desde el host.

## Variables de entorno

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `PORT` | `8080` | Puerto del backend |
| `CORS_ORIGIN` | `http://localhost:5173` | Una cadena vacía desactiva CORS |
| `STATIC_DIR` | (sin definir) | Sirve el frontend compilado desde el backend |
| `VITE_API_URL` | (vacío, mismo origen) | URL base del API, se fija al compilar el frontend |

## Problemas frecuentes

- **`go: cannot find main module`**: se ejecutó desde la raíz del repo. Usa `go -C backend ...`.
- **La UI muestra "Unable to reach the calculator service."**: el backend no está corriendo o no escucha en 8080.
- **En PowerShell, `-coverprofile=coverage.out` se parte en dos argumentos**: usa Bash para los comandos de Go que llevan `=`.
