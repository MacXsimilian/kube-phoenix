# ── Stage 1: Build frontend ───────────────────────────────────────────────────
# Always build on the host platform — Next.js output is arch-independent.
FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend-builder

ARG NEXT_PUBLIC_APP_VERSION

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./

# Cache node_modules across builds; invalidated only when package-lock.json changes.
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Set version after dependency install so version bumps don't bust the npm cache.
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
# Always compile on the host platform using Go cross-compilation (no QEMU).
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend-builder
ARG TARGETARCH

WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./

# Cache downloaded modules; invalidated only when go.sum changes.
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY backend/ ./

# Copy the built frontend into the embed directory
COPY --from=frontend-builder /app/frontend/out ./web/static/

# Copy the OpenAPI spec into the embed directory
COPY openapi.yaml ./internal/docs/openapi.yaml

# Reuse module cache and incremental build cache across invocations.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -o /bin/kube-phoenix ./cmd/server/...

# ── Stage 3: Final minimal image ──────────────────────────────────────────────
FROM gcr.io/distroless/static-debian13:nonroot

COPY --from=backend-builder /bin/kube-phoenix /kube-phoenix

EXPOSE 8080
ENTRYPOINT ["/kube-phoenix"]
