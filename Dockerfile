# syntax=docker/dockerfile:1

# ---- Frontend: build static assets ----
FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend: build a static Go binary ----
FROM golang:1.27-alpine AS backend
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/calculator .

# ---- Runtime: one process serves the API and the frontend ----
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=backend /out/calculator /app/calculator
COPY --from=frontend /src/dist /app/public
ENV PORT=8080 \
    STATIC_DIR=/app/public \
    CORS_ORIGIN=""
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/calculator"]
