# ── Stage 1: Build frontend ───────────────────────────────────────────────────
# Always build on the host platform — Next.js output is arch-independent.
# Digest pins the exact image; update with: docker pull node:24-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f AS frontend-builder

ARG NEXT_PUBLIC_APP_VERSION=dev

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./

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
FROM --platform=$BUILDPLATFORM golang:1.26-alpine@sha256:f85330846cde1e57ca9ec309382da3b8e6ae3ab943d2739500e08c86393a21b1 AS backend-builder
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
FROM gcr.io/distroless/static-debian13:nonroot@sha256:e3f945647ffb95b5839c07038d64f9811adf17308b9121d8a2b87b6a22a80a39

COPY --from=backend-builder /bin/kube-phoenix /usr/local/bin/kube-phoenix

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/kube-phoenix"]
