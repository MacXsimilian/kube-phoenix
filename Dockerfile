# ── Stage 1: Build frontend ───────────────────────────────────────────────────
# Always build on the host platform — Next.js output is arch-independent.
# Digest pins the exact image; update with: docker pull node:24.21.0-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:24.21.0-alpine
FROM --platform=$BUILDPLATFORM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS frontend-builder

ARG NEXT_PUBLIC_APP_VERSION=dev

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
COPY frontend/patches ./patches

# Cache node_modules across builds; invalidated only when package-lock.json changes.
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Set version after dependency install so version bumps don't bust the npm cache.
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

COPY frontend/ ./
RUN --mount=type=cache,target=/app/frontend/.next/cache \
    npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
# Always compile on the host platform using Go cross-compilation (no QEMU).
FROM --platform=$BUILDPLATFORM golang:1.26.8-alpine@sha256:8ac98ca534ac3f51e1f420a1dd2c15e74c75cfa0f23f3ad27eb5d7236c349a0c AS backend-builder
ARG TARGETARCH
ARG NEXT_PUBLIC_APP_VERSION=dev

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
# -trimpath strips host paths from the binary for reproducibility.
# -s -w strips symbol table and DWARF info to reduce binary size.
# -ldflags -X injects the build version into the api.Version variable so that
# GET /api/version returns the correct release tag instead of "dev".
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build \
    -trimpath \
    -ldflags "-s -w -X github.com/macxsimilian/kube-phoenix/backend/internal/api.Version=${NEXT_PUBLIC_APP_VERSION}" \
    -o /bin/kube-phoenix ./cmd/server/...

# ── Stage 3: Final minimal image ──────────────────────────────────────────────
FROM gcr.io/distroless/static-debian13:nonroot@sha256:e2e927ec666bae08560abb3c55d0659eceabb657f56b6782ab500a9fc7f555e3

COPY --from=backend-builder /bin/kube-phoenix /usr/local/bin/kube-phoenix

# Explicit non-root user (65532 = `nonroot` in distroless). Declared so static
# analysers detect a non-root runtime and image scanners do not flag DS-0002.
USER 65532:65532

EXPOSE 8080

# Distroless has no shell or curl, so the binary itself exposes a -healthcheck
# flag that probes /healthz on the loopback port and exits 0/1. start-period
# is generous because schema migrations on first boot can take a few seconds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["/usr/local/bin/kube-phoenix", "-healthcheck"]

ENTRYPOINT ["/usr/local/bin/kube-phoenix"]
