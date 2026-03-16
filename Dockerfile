# ── Stage 1: Build frontend ───────────────────────────────────────────────────
# Always build on the host platform — Next.js output is arch-independent.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder

ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
# Always compile on the host platform using Go cross-compilation (no QEMU).
FROM --platform=$BUILDPLATFORM golang:1.25.8-alpine AS backend-builder
ARG TARGETARCH

WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

# Copy the built frontend into the embed directory
COPY --from=frontend-builder /app/frontend/out ./web/static/

# Copy the OpenAPI spec into the embed directory
COPY openapi.yaml ./internal/docs/openapi.yaml

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -o /bin/kube-phoenix ./cmd/server/...

# ── Stage 3: Final minimal image ──────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=backend-builder /bin/kube-phoenix /kube-phoenix

EXPOSE 8080
ENTRYPOINT ["/kube-phoenix"]
