# Prompts used

This project was built with [Claude Code](https://claude.com/claude-code). Below are the prompts in the order they were used.

Each entry has three parts:

- **Prompt:** a clearer, more complete English rewrite of the original request. It states the context, the constraints and what "done" means, so the prompt can be reused or rerun.
- **Original:** the text exactly as it was typed, in a collapsible block. Several originals were short or written in Spanish.
- **Outcome:** what the prompt produced.

---

## 1. Scaffold the monorepo

**Prompt**

> Set up a monorepo with two projects:
>
> - `frontend/`: a React + TypeScript app created with Vite.
> - `backend/`: a Go REST API that uses only the standard library (`net/http`).
>
> The backend should expose `GET /api/health`, returning `{"status":"ok"}`, with CORS enabled for the Vite dev server. In development, the Vite dev server should proxy `/api/*` to the backend on port 8080. Replace the Vite starter page with a minimal page that calls the health endpoint and shows whether the API is up.
>
> Add a Go unit test for the health route, a root `README.md` with run instructions, and a `.gitignore`. Verify that `go test`, `npm run build` and `npm run lint` pass. Then run both servers and confirm that the health check works both directly and through the proxy.

<details><summary>Original</summary>

> setup a react project and a go rest api

</details>

**Outcome:** the `frontend/` and `backend/` skeletons, the Vite proxy and the health endpoint.

---

## 2. Implement the calculator assignment

**Prompt**

> Using the scaffold from step 1, implement the full-stack calculator described in the brief below. The brief is the source of truth. Prioritise correctness, clarity and maintainability over extra features.
>
> Specific expectations:
>
> - **The backend owns all arithmetic.** Put the maths in a pure Go package with no HTTP code. Every result must be a finite number; anything else is an explicit error. Add a separate HTTP layer that decodes JSON strictly and maps each domain error to a stable error code and HTTP status: 400 for malformed input, 422 for valid input whose maths has no answer.
> - **API shape:** `POST /api/v1/{operation}` with the body `{"operands":[...]}`, plus `GET /api/v1/operations`. Use one error envelope for every failure: `{"error":{"code","message"}}`.
> - **Operations:** add, subtract, multiply, divide, power, square root and percentage. Percentage means "a percent of b".
> - **Frontend:** a keypad calculator that also works with the keyboard and chains operations the way a pocket calculator does. It never computes results itself. Keep the input logic in a pure, unit-testable state machine. Show API and network errors in the display. The layout must be responsive and support light and dark themes.
> - **Quality:** table-driven Go tests, plus Vitest and Testing Library tests for the frontend. Produce a coverage report for both layers.
> - **Delivery:** a multi-stage Dockerfile that serves the built frontend and the API from one non-root container. A README covering setup, run instructions, API examples with `curl`, every error code, and the design decisions and assumptions.
> - **Verification:** run the app in a real browser against the real backend before calling it done, and fix anything that turns up.
>
> Brief:
>
> **Objective.** Build a full-stack calculator application with a React frontend and a backend microservice. The frontend should consume the backend API to perform basic and advanced arithmetic operations. Focus on clean design, maintainable code, and testable architecture.
>
> **Functional requirements.**
> - Operations: addition, subtraction, multiplication, division. Optional: exponentiation, square root, percentage.
> - Frontend (React): an intuitive UI for entering input and displaying results; input validation and error handling; responsive design with basic mobile support.
> - Backend (REST API): endpoints for the calculator operations; input validation and edge-case handling (division by zero, invalid data); results returned as JSON.
>
> **Non-functional requirements.** Clean, readable, idiomatic code in both layers. Unit tests covering key functionality in both layers. Documentation: setup instructions, API usage and design rationale. Optional: a Dockerfile for full-stack deployment.
>
> **Constraints.** Frontend: React, with TypeScript preferred. Backend: Go preferred.
>
> **Deliverables.**
> 1. A Git repository with the frontend and backend code.
> 2. A README with setup instructions, API examples and design decisions.
> 3. Unit tests and a coverage report.
> 4. Optional: a Dockerfile that runs the frontend and backend together.
>
> **Instructions.** Any AI tooling may be used. Spend about 2–4 hours. Push the solution to a Git repository and share the link. Share the prompts used. The README must include setup instructions, how to run the frontend and backend, example API calls, and the design decisions or assumptions.

<details><summary>Original</summary>

The assignment brief was pasted in as-is, with no extra instructions. Its content matches the "Brief" section above.

</details>

**Outcome:**
- The Go `calculator` and `api` packages, the React calculator, and 77 frontend tests plus the Go test suites.
- `docs/coverage.md`, the `Dockerfile`, and the full `README.md`.
- Browser testing exposed two bugs, both fixed and covered by tests. Keystrokes typed while a request was in flight were dropped, and very fast key presses were handled against stale state.

---

## 3. Class diagrams

**Prompt**

> Create a UML class diagram for each project, saved in draw.io format: `backend/class-diagram.drawio` and `frontend/class-diagram.drawio`.
>
> - **Backend:** show each Go package (`main`, `api`, `calculator`) as a frame. Include structs with their fields, functions grouped by source file, the `Operation` type and its constants, and the sentinel errors.
> - **Frontend:** show the components, the `useCalculator` hook, the state machine module and its types, and the API client and its error class.
>
> Use UML visibility (`+` exported, `-` unexported), proper relationship arrows (dependency, association, composition, inheritance, realisation), colour-coding by kind, and a notation legend. Lay the diagrams out so arrows don't cross through classes, and check this by rendering them. Link both files from the README.

<details><summary>Original (Spanish)</summary>

> dentro de las carpetas crea disgramas de clases con archivos .drawio

</details>

**Outcome:** `backend/class-diagram.drawio` and `frontend/class-diagram.drawio`, plus a "Class diagrams" section in the README.

---

## 4. Component interaction skills

**Prompt**

> Create Claude Code project skills in `.claude/skills/` for working with each component of the project:
>
> - **calculator-stack:** start, check and stop the backend, the frontend, or the Docker image.
> - **calculator-api:** call the REST API, with a standard-library Python client and an end-to-end smoke test covering every operation and documented error case.
> - **calculator-ui:** drive the `<Calculator />` component in the browser. Include stable selectors, the keyboard map, a JS snippet that types keys and reads the display, and the expected behaviour.
> - **calculator-tests:** run tests, lint and coverage for both layers, with a script that regenerates `docs/coverage.md`.
> - **calculator-add-operation:** a step-by-step checklist for adding a new operation across the backend, the frontend, the tests, the docs and the diagrams.
>
> Each skill needs a description that makes it easy to trigger. Verify every script against the running servers, and document the skills in the README.

<details><summary>Original (Spanish)</summary>

> Genera skills para interacción con los componentes

</details>

**Outcome:** five skills in `.claude/skills/`. The smoke test passes 25 of 25 cases. The README has a "Claude Code skills" section.

---

## 5. Architecture diagram

**Prompt**

> Create an architecture diagram of the whole system as `docs/architecture.drawio`. It should show:
>
> - The runtime components: the browser and React app (component, hook, state machine, API client) and the Go server (middleware chain, handlers, calculator package).
> - The two ways the app is deployed: local development with two processes and the Vite proxy, and production as a single Docker container serving both on the same origin.
> - A numbered request flow for one representative case, `8 ÷ 0 =`, from key press through the API to the error shown in the display.
>
> Include a legend and colour-code the layers.

<details><summary>Original (Spanish)</summary>

> genera un diagrama de arquitectura del proyecto completo

</details>

**Outcome:** `docs/architecture.drawio`.

---

## 6. Polish this file

**Prompt**

> In `PROMPTS.md`, rewrite each prompt as a clearer, self-contained English prompt that states the context, the constraints and the acceptance criteria. Keep the original wording in a collapsible block so the record of what was actually typed stays accurate. Translate the rest of the file into English.

<details><summary>Original (Spanish)</summary>

> en el md de pronts mejora los pronts y traduce todo a ingles

</details>

**Outcome:** this document.
