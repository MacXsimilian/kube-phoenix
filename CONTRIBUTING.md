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
- **Security vulnerabilities** — see [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Local development setup

**Prerequisites**

| Tool | Version | Purpose |
|---|---|---|
| Go | 1.25+ | Backend |
| Node.js | 22+ | Frontend |
| Docker | any | Local PostgreSQL via `docker-compose.yml` |
| kubectl | any | Optional — cluster endpoints return empty data without it |

**Start everything**

```bash
# 1. Start PostgreSQL (Docker)
make dev

# 2. Backend — http://localhost:8080 (separate terminal)
make dev-backend

# 3. Frontend dev server — http://localhost:3000 (separate terminal)
make dev-frontend
```

The frontend dev server proxies `/api/*` to `http://localhost:8080`. Authentication is disabled when `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` are unset.

**CORS during local development**

If you run the backend and frontend on different ports and see CORS errors:

```bash
export CORS_ALLOWED_ORIGIN=http://localhost:3000
make dev-backend
```

**Run backend tests**

```bash
cd backend && go test ./...
```

**Lint**

```bash
cd backend && golangci-lint run   # requires golangci-lint installed
cd frontend && npm run lint
```

---

## Project structure

```
kube-phoenix/
├── backend/
│   ├── cmd/server/main.go          # Entry point
│   └── internal/
│       ├── api/                    # HTTP handlers + Chi router
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
|---|---|---|
| `feat:` | minor | new user-facing feature |
| `fix:` | patch | bug fix |
| `perf:` | patch | performance improvement |
| `feat!:` / `BREAKING CHANGE:` | major | breaking API or behaviour change |
| `docs:` | none | documentation only |
| `ci:` | none | CI/CD changes |
| `chore:` | none | maintenance, dependencies, config |
| `refactor:` | none | code restructure, no behaviour change |
| `test:` | none | test-only changes |

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
- [ ] README / ARCHITECTURE.md updated if the change affects documented behaviour, API routes, or configuration
- [ ] Commit messages follow conventional commit format

---

## CI pipeline

CI runs automatically on every PR. All jobs must pass before merging.

| Job | What it checks |
|---|---|
| Frontend build | `npm install`, `npm audit` (high severity gate), `npm run build` |
| Backend build | `go vet`, `go test`, `go build`, `govulncheck`, golangci-lint + gosec |
| Helm lint | `helm lint helm/kube-phoenix` |
| Secret scan | TruffleHog — verified leaked secrets only |

---

## Releases

Release management is fully automated via [release-please](https://github.com/googleapis/release-please).

1. Merge PRs to `master` with conventional commit messages.
2. release-please opens a Release PR with the bumped version and CHANGELOG diff.
3. Review and merge the Release PR.
4. Docker image (`ghcr.io/macxsimilian/kube-phoenix`) and Helm chart (`oci://ghcr.io/macxsimilian/helm/kube-phoenix`) are published automatically.

**Never create tags manually.**
