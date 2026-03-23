# Contributing to kube-phoenix

Welcome, and thank you for considering a contribution to kube-phoenix. Whether you are
fixing a typo, reporting a bug, or proposing a major feature, your involvement is
valued. This guide explains how to set up a development environment, submit changes,
and navigate the review process.

## Types of Contributions

| Contribution | How to start |
| :----------- | :----------- |
| Bug fix or small improvement | Open a pull request directly |
| New feature | Open an issue first to discuss the approach |
| Documentation | Open a pull request directly |
| Security vulnerability | Report privately via [GitHub Security Advisories][security] -- do **not** open a public issue |

---

## Development Environment

### Prerequisites

| Tool | Version | Purpose |
| :--- | :------ | :------ |
| Go | 1.26+ | Backend compilation and tests |
| Node.js | 24+ | Frontend build (Next.js) |
| Docker | any | Local PostgreSQL via `docker compose` |
| golangci-lint | v2+ | Backend linting (`go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest`) |
| govulncheck | latest | Vulnerability scanning (`go install golang.org/x/vuln/cmd/govulncheck@latest`) |
| kubectl | any | Optional -- cluster endpoints return empty data without it |

### Quick Start

```bash
# 1. Clone and enter the repository
git clone https://github.com/MacXsimilian/kube-phoenix.git
cd kube-phoenix

# 2. Start PostgreSQL
make dev

# 3. Start the backend (separate terminal) -- http://localhost:8080
make dev-backend

# 4. Start the frontend dev server (separate terminal) -- http://localhost:3000
make dev-frontend
```

The backend auto-migrates the database schema and seeds default data on startup. No
manual migration step is needed. Authentication is disabled when `ADMIN_USER` /
`ADMIN_PASSWORD` are unset.

### CORS Configuration

If the frontend and backend run on different ports and you see CORS errors:

```bash
CORS_ALLOWED_ORIGIN=http://localhost:3000 make dev-backend
```

### Running Tests and Linters

```bash
make test          # backend unit tests
make lint          # golangci-lint (includes gosec)
```

---

## Project Structure

```
kube-phoenix/
  openapi.yaml                    # OpenAPI 3.1 spec -- update for every API change
  backend/
    cmd/server/main.go            # Entry point
    internal/
      api/                        # HTTP handlers + Chi router
      docs/                       # Embedded openapi.yaml (copied at build time)
      policy/                     # Sleep window compiler
      scheduler/                  # PolicyScheduler, PolicyEngine, WS log broker
      scaler/                     # PolicyScaler (DB-backed sleep/wake)
      k8s/                        # Kubernetes client + ClusterCache
      store/                      # GORM models + queries
      middleware/                  # BasicAuth
  frontend/src/
    app/                          # Next.js pages
    components/                   # Reusable UI components
    lib/                          # API client, auth context, TypeScript types
    theme/                        # MUI theme (dark + light)
  helm/kube-phoenix/              # Helm chart
  examples/                       # Example Helm value overlays
```

---

## Development Workflow

kube-phoenix uses **GitHub Flow** -- a single protected `master` branch with
short-lived feature branches.

```bash
git checkout master && git pull
git checkout -b feat/your-feature

# Make changes, test locally, then push
git push -u origin feat/your-feature
```

Open a pull request against `master` on GitHub as soon as you have something
reviewable. Keep branches short-lived.

---

## Commit Conventions

All commits must follow [Conventional Commits](https://www.conventionalcommits.org).
release-please reads these to determine the version bump and generate the changelog.

| Prefix | Version bump | Use for |
| :----- | :----------- | :------ |
| `feat:` | minor | New user-facing feature |
| `fix:` | patch | Bug fix |
| `perf:` | patch | Performance improvement |
| `feat!:` / `BREAKING CHANGE:` | major | Breaking API or behaviour change |
| `docs:` | none | Documentation only |
| `ci:` | none | CI/CD changes |
| `chore:` | none | Maintenance, dependencies, config |
| `refactor:` | none | Code restructure, no behaviour change |
| `test:` | none | Test-only changes |

> **Pre-1.0 note:** While the project is below v1.0, `feat:` bumps **patch** (not
> minor) and `feat!:` bumps **minor** (not major). After v1.0.0 the table above
> applies as written.

**Examples:**

```
feat: add emergency wake endpoint
fix(scheduler): reload cron entries after timezone change
docs: add troubleshooting section to README
```

Keep the subject line under 72 characters. Add a body when the change needs context.

---

## Pull Request Process

### Before Requesting Review

- [ ] `make test` passes
- [ ] `make lint` introduces no new warnings
- [ ] `npm run build` passes in `frontend/`
- [ ] New behaviour is covered by tests where practical
- [ ] `openapi.yaml` updated if any API route or schema changed
- [ ] README or ARCHITECTURE.md updated if documented behaviour changed
- [ ] All commits follow the conventional commit format

### Review Expectations

- At least one maintainer approval is required before merge.
- Reviewers may request changes; please address or discuss each comment.
- Keep the PR focused on a single concern. Split unrelated changes into separate PRs.

### Merge Criteria

- All required CI checks pass.
- No unresolved review threads.
- The branch is up to date with `master`.

---

## CI Pipeline

Two workflows run automatically on every pull request. All required jobs must pass
before merging.

### CI (`ci.yml`)

Triggered on PRs and pushes to `master` when relevant paths change.

| Job | What it checks |
| :-- | :------------- |
| Frontend build | `npm ci` and `npm run build` |
| Backend build | `go vet`, `go test` with coverage, `go build`, golangci-lint, OpenAPI spec sync |
| Helm lint | `helm lint helm/kube-phoenix` |
| Go Report Card | Triggers rescan at goreportcard.com (push to `master` only) |

### Security (`security.yml`)

Triggered on PRs, pushes to `master`, and weekly (Monday 06:00 UTC).

| Job | What it checks |
| :-- | :------------- |
| govulncheck | Go dependency vulnerability scan |
| npm audit | npm dependency audit (high-severity gate) |
| Trivy image scan | Container image vulnerabilities |
| Trivy filesystem scan | IaC and dependency scan |
| TruffleHog | Verified leaked secrets |

All GitHub Actions versions are pinned to full commit SHAs for supply-chain integrity.

---

## Release Process

Releases are fully automated via [release-please](https://github.com/googleapis/release-please).

1. Merge PRs to `master` using conventional commit messages.
2. release-please opens a **Release PR** containing the version bump and changelog diff.
3. Merging the Release PR triggers the release pipeline:
   - Docker image pushed to `ghcr.io/macxsimilian/kube-phoenix` (semver tags + `latest`).
   - Trivy scans the published image; CRITICAL/HIGH unfixed CVEs block the release.
   - Helm chart pushed to `oci://ghcr.io/macxsimilian/helm/kube-phoenix`.

Never create Git tags manually -- release-please owns all tags and releases.

---

## Code of Conduct

All participants are expected to treat each other with respect. Constructive criticism
of code and ideas is welcome; personal attacks are not. See
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the full policy.

---

## Getting Help

- **Bug reports and feature requests** -- [open an issue][issues].
- **Questions and discussions** -- use [GitHub Discussions][discussions].
- **Security concerns** -- report via [GitHub Security Advisories][security].

[security]: https://github.com/MacXsimilian/kube-phoenix/security/advisories/new
[issues]: https://github.com/MacXsimilian/kube-phoenix/issues
[discussions]: https://github.com/MacXsimilian/kube-phoenix/discussions
