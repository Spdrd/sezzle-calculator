# Sezzle Calculator

A full-stack calculator. A **React + TypeScript** frontend does no arithmetic of its own: every operation goes to a **Go REST API**, which validates the input and returns the result as JSON.

| Layer    | Stack                                           | Location     |
|----------|-------------------------------------------------|--------------|
| Frontend | React 19, TypeScript, Vite, Vitest + Testing Library | `frontend/`  |
| Backend  | Go (standard library only: `net/http`, `encoding/json`, `log/slog`) | `backend/`   |
| Deploy   | Multi-stage Dockerfile that serves the frontend and API from one container | `Dockerfile` |

Supported operations: **add, subtract, multiply, divide, power, square root, percentage**.

---

## Quick start

### Option A: Docker (one command)

```bash
docker build -t sezzle-calculator .
docker run --rm -p 8080:8080 sezzle-calculator
```

Then open http://localhost:8080. The Go binary serves both the built React app and the API on the same origin.

### Option B: Run locally for development

Requirements: **Go 1.23+** and **Node.js 20+**.

Start the backend on http://localhost:8080:

```bash
cd backend
go run .
```

In a second terminal, start the frontend on http://localhost:5173:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `localhost:8080`, so the browser only ever talks to one origin.

### Configuration

| Variable       | Default                  | Description |
|----------------|--------------------------|-------------|
| `PORT`         | `8080`                   | Backend listen port. |
| `CORS_ORIGIN`  | `http://localhost:5173`  | Value of `Access-Control-Allow-Origin`. Set it to an empty string to turn CORS off (the Docker image does this). |
| `STATIC_DIR`   | *(unset)*                | If set, the backend serves this directory at `/`, falling back to `index.html` for unknown paths. |
| `VITE_API_URL` | *(empty = same origin)*  | Frontend build-time API base URL, for when the API lives on a different host. |

---

## Tests and coverage

```bash
# Backend
cd backend
go test ./...
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html
```

```bash
# Frontend
cd frontend
npm test              # run once
npm run coverage      # text summary + HTML report in frontend/coverage/
```

Current coverage:

| Package / area                         | Statements |
|----------------------------------------|-----------:|
| `backend/internal/calculator`          | 100%       |
| `backend/internal/api`                 | 98%        |
| `frontend/src` (all files)             | 100% statements, 97% branches |

`backend/main.go` only wires up config and starts the server, so it has no unit tests (`go test` reports it as 0%). Its behaviour is covered by the router tests and by the Docker smoke test. The full reports are in [`docs/coverage.md`](docs/coverage.md).

---

## API

Base path: `/api/v1`. Every response is JSON.

### `POST /api/v1/{operation}`

Request body:

```json
{ "operands": [<number>, ...] }
```

| Operation    | Operands | Meaning                          |
|--------------|:--------:|----------------------------------|
| `add`        | 2        | a + b                            |
| `subtract`   | 2        | a − b                            |
| `multiply`   | 2        | a × b                            |
| `divide`     | 2        | a ÷ b                            |
| `power`      | 2        | a raised to the power of b      |
| `percentage` | 2        | a percent of b, i.e. a / 100 × b |
| `sqrt`       | 1        | √a                               |

Success, `200 OK`:

```bash
curl -s -X POST http://localhost:8080/api/v1/add \
  -H "Content-Type: application/json" -d '{"operands":[2,3]}'
```

```json
{"operation":"add","operands":[2,3],"result":5}
```

More examples:

```bash
curl -s -X POST localhost:8080/api/v1/divide     -d '{"operands":[1,8]}'     # {"...","result":0.125}
curl -s -X POST localhost:8080/api/v1/power      -d '{"operands":[2,10]}'    # {"...","result":1024}
curl -s -X POST localhost:8080/api/v1/sqrt       -d '{"operands":[81]}'      # {"...","result":9}
curl -s -X POST localhost:8080/api/v1/percentage -d '{"operands":[15,200]}'  # {"...","result":30}
```

Errors always use one envelope, with a stable `code` meant for programs and a `message` meant for people:

```bash
curl -s -X POST localhost:8080/api/v1/divide -d '{"operands":[1,0]}'
```

```json
{"error":{"code":"division_by_zero","message":"cannot divide by zero"}}
```

| Status | `code`                  | When |
|-------:|-------------------------|------|
| 400    | `invalid_json`          | Body is empty, malformed, has unknown fields, or holds more than one JSON value. |
| 400    | `invalid_operand`       | An operand is not a number, is `null`, or is outside the float64 range (e.g. `1e400`). |
| 400    | `invalid_operand_count` | Wrong number of operands for the operation. |
| 404    | `unknown_operation`     | `{operation}` is not supported. |
| 404    | `not_found`             | Any other unknown `/api` route. |
| 413    | `body_too_large`        | Body is over 1 KiB. |
| 422    | `division_by_zero`      | `divide` by 0, or `power` with base 0 and a negative exponent. |
| 422    | `negative_sqrt`         | `sqrt` of a negative number. |
| 422    | `undefined_result`      | Result is not a real number, e.g. `power` of −8 to the 0.5. |
| 422    | `result_out_of_range`   | Result overflows float64, e.g. `power` of 10 to the 400. |
| 500    | `internal_error`        | Unexpected failure. Panics are recovered and logged. |

### `GET /api/v1/operations`

Lists the supported operations with their arity, so a client can find out what's available.

```json
{"operations":[{"name":"add","arity":2,"description":"a + b"}, ...]}
```

### `GET /api/health`

Liveness check that returns `{"status":"ok"}`.

---

## Using the UI

- Click the keypad or type: digits, `.`, `+ - * /`, `^` (power), `%` (percent of), `r` (√), `n` (±), `Enter` or `=`, `Backspace`, `Esc` (clear).
- Operations chain the way a pocket calculator's do: `2 + 3 ×` shows `5` and waits for the next operand.
- `√` applies to the number on screen right away, and also works as the second operand (`5 + √16 =` gives `9`).
- `% of` is a binary operation: `15 % of 200 =` gives `30`.
- Errors from the API (division by zero, negative square root, network failure) appear in the display. Typing a digit starts over.
- The layout adapts to narrow screens and follows the system light/dark theme.

---

## Design decisions

**The backend is the only place arithmetic happens.** The assignment says the frontend should consume the API, so the client never computes results itself, not even for `+`. The frontend tracks input and display state; Go owns the maths and the validation.

**The backend is split into layers.**
- `internal/calculator` is pure Go with no HTTP. Each operation is a table entry (arity, description, function), so adding one is a single entry. It returns sentinel errors (`ErrDivisionByZero`, …) that callers match with `errors.Is`. It also guarantees every successful result is finite, turning NaN and ±Inf into explicit errors, and it normalises `-0` to `0`.
- `internal/api` handles transport only: strict JSON decoding, mapping errors to status codes, and middleware for CORS, logging and panic recovery.
- `main.go` reads config from environment variables and shuts down gracefully on SIGINT/SIGTERM.

**There's one endpoint per operation, with a uniform body.** `POST /api/v1/add` keeps URLs self-describing and lets the router reject unknown operations before reading the body. An `operands` array (instead of `a`/`b`) handles unary and binary operations the same way. Endpoints sit under `/v1` so the contract can change later without breaking clients.

**400 and 422 mean different things.** 400 is a malformed request the client should fix. 422 is a valid request whose maths has no answer, like division by zero. Clients can then tell bugs apart from user errors.

**Input validation is strict.** `DisallowUnknownFields`, a 1 KiB body limit, only one JSON value per body, and operands decoded as `*float64`, because `encoding/json` would otherwise quietly turn `null` into `0` and `[null, 2]` would add up to `2`.

**The backend has no third-party dependencies.** Go 1.22's `ServeMux` handles method and path-parameter routing, so there's no need for a router framework. That means nothing to audit and a tiny static binary.

**The frontend logic is a pure state machine.** `src/calculator/state.ts` holds a reducer plus `planKey(state, key)`. `planKey` decides whether a key press is a local state change or an API request, and which state change to apply when the request succeeds. The async part lives in one small hook (`useCalculator`). That keeps all the calculator behaviour (chaining, switching operators, recovering from errors) unit-testable without React or a network, and the hook takes an injectable `calculate` function, so the component tests don't need a server.

**Key presses are serialized.** Since results come from the network, a fast typist can press keys while a request is still in flight. The hook puts every key in a FIFO queue drained by one async loop. The loop plans each key against the latest state, which is held in a ref, rather than against a possibly stale render. Keys typed mid-request (`2 + 3 × 4 =`) are applied in order once the request finishes. If a request fails, the queue is discarded so the error stays on screen.

**Floating-point display.** The API returns full-precision float64 values. The UI rounds to 12 significant digits when it displays a number, so `0.1 + 0.2` shows `0.3`, but chained operations still get the server's exact value.

**Assumptions.**
- Numbers are IEEE-754 double precision. There's no arbitrary-precision or decimal arithmetic.
- `percentage` means "a percent of b". That reads better than a unary ÷100, and it's what the keypad's "% of" label says.
- `0 ^ 0 = 1`, following IEEE and Go's `math.Pow`.
- Typed operands are limited to 15 digits, about the precision a float64 can represent exactly.
- No authentication, persistence or rate limiting, since those are out of scope for a stateless calculator.

**Deployment.** The Dockerfile has three stages: Node builds the SPA, Go builds a static binary, and the final image is `distroless/static`, running as a non-root user with no shell. One process serves the API and the assets, so there's no CORS and no reverse proxy.

---

## Project layout

```
backend/
  class-diagram.drawio        # UML class diagram of the backend (open with draw.io / diagrams.net)
  main.go                     # config, server, graceful shutdown
  internal/calculator/        # pure arithmetic + validation (100% covered)
  internal/api/               # routes, handlers, middleware, SPA serving
frontend/
  class-diagram.drawio        # UML class diagram of the frontend
  src/api/client.ts           # typed fetch wrapper → CalculatorApiError
  src/calculator/             # operations, state machine, formatting, keyboard map, hook
  src/components/Calculator.tsx
Dockerfile
docs/architecture.drawio      # architecture diagram (3 pages)
docs/coverage.md
PROMPTS.md                    # prompts used with AI tooling
```

## Architecture diagram

[`docs/architecture.drawio`](docs/architecture.drawio) covers the whole project in three pages (labels are in Spanish):

1. **Arquitectura**: the layers of the React SPA (presentation → `useCalculator` orchestration → pure state machine → API client), the HTTP/JSON contract, and the layers of the Go server (process → middleware chain → router / SPA handler → transport → `calculator` domain).
2. **Despliegue**: local development (Vite dev server proxying `/api` to `go run`) next to the three-stage Docker build and the single-container runtime, plus the configuration variables.
3. **Flujo de una petición**: a sequence diagram of `8 ÷ 0 =` from key press to the error on screen, with notes on the success path and on keys queued during a request.

Open it with [diagrams.net](https://app.diagrams.net), the draw.io desktop app, or the *Draw.io Integration* extension for VS Code. Pages are tabs along the bottom.

## Class diagrams

UML class diagrams in draw.io format:

- [`backend/class-diagram.drawio`](backend/class-diagram.drawio) shows the `main`, `api` and `calculator` packages: structs, functions grouped by file, sentinel errors, and how they depend on each other.
- [`frontend/class-diagram.drawio`](frontend/class-diagram.drawio) shows the components, the `useCalculator` hook, the state machine (`state.ts`) and its types, and the API client.

To view or edit them, open the files in [diagrams.net](https://app.diagrams.net), the draw.io desktop app, or the *Draw.io Integration* extension for VS Code.

## Claude Code skills

`.claude/skills/` contains project skills that let Claude Code (or a developer reading them) work with each component:

| Skill | Purpose |
|---|---|
| `calculator-stack` | Start, check or stop the backend, the frontend, or the Docker image. |
| `calculator-api` | Call the REST API (`scripts/calc.py`) and run a 25-case end-to-end smoke test (`scripts/smoke.py`). |
| `calculator-ui` | Drive the `<Calculator />` component in a browser: selectors, keyboard map, and expected behaviour. |
| `calculator-tests` | Run tests, lint and coverage, and regenerate `docs/coverage.md` (`scripts/coverage_report.py`). |
| `calculator-add-operation` | Checklist for adding an operation across both layers, their tests, the docs and the diagrams. |

The scripts use only the Python standard library:

```bash
python .claude/skills/calculator-api/scripts/smoke.py --base http://localhost:8080
```

## AI usage

This project was built with Claude Code. The prompts are in [PROMPTS.md](PROMPTS.md).
