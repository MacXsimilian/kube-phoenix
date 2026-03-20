# Contributing to kube-phoenix

Thank you for taking the time to contribute. This guide covers everything you need to go from zero to an open PR.

---

## Table of Contents

- [Code of conduct](#code-of-conduct)
- [Before you start](#before-you-start)
- [Local development setup](#local-development-setup)
- [Project structure](#project-structure)
- [Branching strategy](#branching-strategy)
- [Commit conventions](#commit-conventions)
- [Pull request checklist](#pull-request-checklist)
- [CI pipeline](#ci-pipeline)
- [Releases](#releases)

---

## Code of conduct

Be respectful. Criticism of code and ideas is welcome; criticism of people is not.

---

## Before you start

- **Bug fixes and small improvements** — open a PR directly.
- **New features** — open an issue first to discuss the approach. This avoids wasted effort if the direction doesn't fit the project.
- **Security vulnerabilities** — do **not** open a public issue. Report privately via [GitHub Security Advisories](https://github.com/MacXsimilian/kube-phoenix/security/advisories/new). Include a reproduction case and the potential impact. You will receive a response within 7 days.

---

## Local development setup

**Prerequisites**

| Tool | Version | Purpose |
| :--- | :------ | :------ |
| Go | 1.26.x | Backend |
| Node.js | 24+ | Frontend |
| Docker | any | Local PostgreSQL via `docker-compose.yml` |
| kubectl | any | Optional — cluster endpoints return empty data without it |
| golangci-lint | v2+ | Backend linting (`go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`) |
| govulncheck | latest | Backend vulnerability checks (`go install golang.org/x/vuln/cmd/govulncheck@latest`) |

**Start everything**

```bash
# 1. Start PostgreSQL (Docker)
make dev

# 2. Backend — http://localhost:8080 (separate terminal)
make dev-backend

# 3. Frontend dev server — http://localhost:3000 (separate terminal)
make dev-frontend
```

In development, the frontend uses the `NEXT_PUBLIC_API_URL` environment variable to reach the backend API. When unset, it defaults to the same origin (relative `/api/*` paths). Set `NEXT_PUBLIC_API_URL=http://localhost:8080` when running the frontend dev server on a separate port. Authentication is disabled when `ADMIN_USER` / `ADMIN_PASSWORD` are unset.

The backend auto-migrates the database schema and seeds default data (4 schedules + guardrails) on startup. No manual migration step is needed.

**CORS during local development**

If you run the backend and frontend on different ports and see CORS errors:

```bash
export CORS_ALLOWED_ORIGIN=http://localhost:3000
make dev-backend
```

**Run backend tests**

```bash
cd backend && go test -coverprofile=coverage.out ./...
cd backend && go tool cover -func=coverage.out
```

**Lint**

```bash
cd backend && golangci-lint run   # requires golangci-lint v2 installed
```

> **Note:** Frontend linting is not yet configured. See the roadmap for planned ESLint setup.

---

## Project structure

```
kube-phoenix/
├── openapi.yaml                    # OpenAPI 3.1 spec — update for every API change
├── backend/
│   ├── cmd/server/main.go          # Entry point
│   └── internal/
│       ├── api/                    # HTTP handlers + Chi router
│       ├── docs/                   # Embedded openapi.yaml (copied at build time)
│       ├── scheduler/              # Cron wrapper + WebSocket log broker
│       ├── scaler/                 # scale_down / scale_up logic
│       ├── k8s/                    # Kubernetes client + ClusterCache
│       ├── store/                  # GORM models + queries
│       └── middleware/             # BasicAuth
├── frontend/src/
│   ├── app/                        # Next.js pages
│   ├── components/                 # Reusable UI components
│   ├── lib/                        # API client, auth context, TypeScript types
│   └── theme/                      # MUI theme (dark + light)
├── helm/kube-phoenix/              # Helm chart
└── examples/                       # Example Helm value overlays
```

---

## Branching strategy

kube-phoenix uses **GitHub Flow** — a single protected `master` branch and short-lived feature branches.

```
master  (protected, always deployable)
  ├── feat/emergency-wake   → PR → master
  ├── fix/websocket-auth    → PR → master
  └── docs/update-api-ref   → PR → master
```

- Branch off `master` for every non-trivial change.
- Keep branches short-lived — open a PR as soon as you have something reviewable.
- Never create tags manually — release-please owns all tags and releases.

```bash
git checkout master && git pull
git checkout -b feat/your-feature

# ... make changes ...

git push -u origin feat/your-feature
# Open a PR against master on GitHub
```

---

## Commit conventions

kube-phoenix uses [Conventional Commits](https://www.conventionalcommits.org). release-please reads these to determine the version bump and generate the CHANGELOG automatically.

| Prefix | Version bump | Use for |
| :----- | :----------- | :------ |
| `feat:` | minor | new user-facing feature |
| `fix:` | patch | bug fix |
| `perf:` | patch | performance improvement |
| `feat!:` / `BREAKING CHANGE:` | major | breaking API or behaviour change |
| `docs:` | none | documentation only |
| `ci:` | none | CI/CD changes |
| `chore:` | none | maintenance, dependencies, config |
| `refactor:` | none | code restructure, no behaviour change |
| `test:` | none | test-only changes |

> **Pre-1.0 note:** While the project is pre-1.0 (current version 0.1.x), release-please is configured with `bump-patch-for-minor-pre-major: true`. This means `feat:` commits bump the **patch** version (not minor), and `feat!:` / `BREAKING CHANGE:` commits bump **minor** (not major). After v1.0.0, the table above applies as written.

**Examples**

```bash
git commit -m "feat: add emergency wake endpoint"
git commit -m "fix(scheduler): reload cron entries after timezone change"
git commit -m "docs: add troubleshooting section to README"
git commit -m "chore: bump golangci-lint to v2"
```

Keep the subject line under 72 characters. Add a body if the change needs context.

---

## Pull request checklist

Before requesting review, confirm:

- [ ] `go test ./...` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] No new `golangci-lint` or `govulncheck` warnings introduced
- [ ] New behaviour is covered by a test where practical
- [ ] `openapi.yaml` updated if the change adds, removes, or modifies any API route or schema
- [ ] README / ARCHITECTURE.md updated if the change affects documented behaviour, API routes, or configuration
- [ ] Commit messages follow conventional commit format

---

## CI pipeline

Two workflows run automatically. All required jobs must pass before merging.

### CI workflow (`.github/workflows/ci.yml`)

Runs on every PR and push to `master` when relevant paths change (`frontend/**`, `backend/**`, `openapi.yaml`, `Dockerfile`, `helm/**`, `.github/workflows/**`).

| Job | What it checks |
| :-- | :------------- |
| Frontend build | `npm ci`, `npm run build` |
| Backend build | `go vet`, `go test` + coverage report, `go build`, golangci-lint v2 (includes gosec), OpenAPI spec sync check |
| Helm lint | `helm lint helm/kube-phoenix` |
| Go Report Card | Triggers a rescan at goreportcard.com (on push to `master` only) |

### Security workflow (`.github/workflows/security.yml`)

Runs on every PR, push to `master`, **and weekly** (Monday 06:00 UTC).

| Job | What it checks |
| :-- | :------------- |
| govulncheck | Go dependency vulnerability scan |
| npm audit | npm dependency audit (high severity gate) |
| Trivy image scan | Container image vulnerability scan |
| Trivy filesystem scan | IaC and dependency scan |
| TruffleHog | Verified leaked secrets only |

All GitHub Actions action versions are pinned to a full commit SHA for supply chain integrity. When updating an action, always pin to the new SHA rather than a floating tag.

---

## Releases

Release management is fully automated via [release-please](https://github.com/googleapis/release-please).

1. Merge PRs to `master` with conventional commit messages.
2. release-please opens a Release PR with the bumped version and CHANGELOG diff.
3. Review and merge the Release PR — this triggers the full release pipeline:
   - Docker image built and pushed to `ghcr.io/macxsimilian/kube-phoenix` (semver tags + `latest`)
   - Trivy vulnerability scan runs against the published image; CRITICAL/HIGH unfixed CVEs block the release
   - Helm chart packaged and pushed to `oci://ghcr.io/macxsimilian/helm/kube-phoenix`

**Never create tags manually.**
