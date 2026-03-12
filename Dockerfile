# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM golang:1.22-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

# Copy the built frontend into the embed directory
COPY --from=frontend-builder /app/frontend/out ./web/static/

RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/kube-phoenix ./cmd/server/...

# ── Stage 3: Final minimal image ──────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=backend-builder /bin/kube-phoenix /kube-phoenix

EXPOSE 8080
ENTRYPOINT ["/kube-phoenix"]
