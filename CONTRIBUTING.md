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
| Go | 1.27.2+ | Backend compilation and tests; minimum from `backend/go.mod` |
| Node.js | 26 (Current) | Frontend build (Next.js); matches Docker and CI |
| Docker | any | Local PostgreSQL via `docker compose` |
| golangci-lint | v2.14.0 | Matches CI (`go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0`) |
| govulncheck | latest | Vulnerability scanning (`go install golang.org/x/vuln/cmd/govulncheck@latest`) |
| kubectl | Within one minor version of the API server | Optional CLI for cluster setup and inspection; the backend uses `client-go` directly |

Follow the [Kubernetes kubectl version-skew policy](https://kubernetes.io/releases/version-skew-policy/#kubectl). Backend cluster access depends on in-cluster credentials or a valid kubeconfig. If the Kubernetes client cannot be configured, cluster endpoints return HTTP 503 (`kubernetes client unavailable`); the absence of the kubectl executable alone does not disable them.

### Quick Start

For the full setup guide -- including deploying into a local Kubernetes cluster with
minikube and testing scaling end-to-end -- see the
[Local Development Guide](docs/local-development.md).

The shortest path to a running UI (no cluster, no scaling):

```bash
# 1. Clone and enter the repository
git clone https://github.com/MacXsimilian/kube-phoenix.git
cd kube-phoenix

# 2. Start PostgreSQL
make dev

# 3. Start the backend (separate terminal) -- http://localhost:8080
ADMIN_USER=admin ADMIN_PASSWORD=adminadmin \
  COOKIE_SECURE=false CORS_ALLOWED_ORIGIN=http://localhost:3000 make dev-backend

# 4. Create frontend env file (one-time)
echo 'NEXT_PUBLIC_API_URL=http://localhost:8080' > frontend/.env.local

# 5. Start the frontend dev server (separate terminal) -- http://localhost:3000
make dev-frontend
```

Alternatively, if you only need the frontend (no backend or cluster):

```bash
make dev-mock    # starts frontend with a built-in mock API server
```

Open `http://localhost:3000` and log in with `admin` / `adminadmin`.

With the default `AUTO_MIGRATE=true`, the backend migrates application tables and
seeds default data on startup. If you disable AutoMigrate, provision the matching
schema and apply the [snapshot-intent migration](backend/migrations/20261008_snapshot_intents.sql)
before starting this version. See [configuration](docs/configuration.md#backend-runtime).

> **Note:** Authentication is always enforced. `ADMIN_USER` and `ADMIN_PASSWORD` must be
> set to seed an admin account -- without them a fresh database has no local account to log in with.
> `CORS_ALLOWED_ORIGIN` is required when the frontend and backend run on different ports.
> `COOKIE_SECURE=false` permits session cookies for this local HTTP setup.
> `NEXT_PUBLIC_API_URL` tells the frontend where to find the backend (baked in at
> startup -- restart the frontend after changing it).

### Running Tests and Linters

```bash
make copy-spec     # refresh the embedded OpenAPI spec
make test          # backend tests; database integration tests need TEST_DATABASE_URL
make lint          # golangci-lint (includes gosec)
```

See [local regression checks](docs/local-development.md#regression-checks) for
disposable PostgreSQL integration tests, frontend and chart checks, and the
[final-image smoke check](docs/local-development.md#final-image-smoke-check).
CI runs backend tests with `-race -count=1` and requires `TEST_DATABASE_URL`; a
local run without it skips the database-backed reliability tests.

---

## Project Structure

```
kube-phoenix/
  openapi.yaml                    # OpenAPI 3.1 spec -- update for every API change
  backend/
    cmd/server/main.go            # Entry point
    internal/
      api/                        # HTTP handlers + Chi router (cluster handlers split by resource type)
      auth/                       # OIDC provider, RBAC permissions, rate limiting
      docs/                       # Embedded openapi.yaml (copied at build time)
      k8s/                        # Kubernetes client + ClusterCache
      metrics/                    # Prometheus metrics (promauto registration)
      middleware/                  # Session auth, CSRF, rate-limit middleware
      nodeutil/                   # Shared node protection helpers (label/taint matching, critical pod detection)
      policy/                     # Sleep window compiler
      scaler/                     # PolicyScaler (DB-backed sleep/wake)
      scheduler/                  # PolicyScheduler, PolicyEngine, WS log broker
      store/                      # GORM models + queries
      stringutil/                 # Generic string helpers (CSV parsing, etc.)
  frontend/mock-api/                # Modular mock API server with route files
  frontend/src/
    app/                          # Next.js pages
    components/                   # UI components by domain (audit, auth, cluster, common, guardrails,
                                  #   history, layout, observability, overview, policies, settings, shared)
    lib/                          # API client (apiFetch), auth context, types, rbac, observability-types, motion/, shared hooks, utilities
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

### Pull Request Title and Description

Use a Conventional Commit title that describes the final change, for example
`fix(scheduler): preserve exception scope during recovery`. Keep it under 72
characters and use `!` for breaking changes, including operational or configuration
changes. Update the title and description when the scope changes.

Use the [pull request template](.github/pull_request_template.md) with these seven
sections, in this order. Keep the headings unnumbered. Do not add separate
**Motivation**, **Files Changed**, or **Type of change** sections.

| Section | What to include |
| :------ | :-------------- |
| Summary | One or two short paragraphs explaining the problem and resulting behavior. Include the reason for the change here. |
| Changes | Concrete changes as bullets, grouped by area when useful. Describe the final implementation; omit abandoned approaches and conversational history. |
| Breaking Changes | Changes to existing behavior, APIs, configuration, permissions, deployment, or tool requirements. Write `None.` when there are none. |
| Migration Notes | Required operator or developer steps, ordering, downtime, and rollback considerations where applicable. Write `No migration required.` when none are needed. |
| Dependency Changes | A table of changed dependencies with previous and updated versions compared with the PR base. Include relevant build images and CI actions. Identify selected highlights if transitive updates are omitted, and link to the manifests or lockfiles. Write `None.` when there are none. |
| Related Issues | Link relevant issues or prior PRs. Use `Fixes #123` only when the PR resolves that issue; otherwise use `Related to #123`. Write `Not tied to a tracked issue.` when applicable. |
| Checklist | Relevant validation and completion items with accurate status. Record commands, results, and material limitations here. |

Scale the detail to the change: a small fix needs only a few sentences and bullets;
changes spanning several areas need enough detail to review each area. Use paths
only when they help explain a change. The description must reflect the PR diff;
commit any intended local changes before claiming they are included.

Check an item only when it has been verified. Remove inapplicable checklist items
or mark them explicitly as not applicable. Leave pending checks unchecked and
explain failures, skipped tests, and unavailable environments. Distinguish earlier
validation from results for the final revision, and distinguish unit/fake-client
coverage from real database or Kubernetes validation.

Chart version and appVersion updates are managed by release-please in its release
PR. Preserve breaking-change details and independent release entries in the squash
commit as described in [Complete Release Notes](#complete-release-notes).
Automated dependency and release PRs may retain their generated format.

### Before Requesting Review

- [ ] `make test` passes
- [ ] `make lint` introduces no new warnings
- [ ] Frontend lint, typecheck, regression checks, and build pass for UI changes
- [ ] Database reliability tests pass with `TEST_DATABASE_URL` for store/scheduler changes
- [ ] Rendered chart regression checks pass for Helm changes
- [ ] Final-image smoke check passes for Docker or embedded asset changes
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

Triggered on all PRs to `master`, pushes to `master`, and manual dispatch. There are no path filters.

| Job | What it checks |
| :-- | :------------- |
| Frontend build | `npm ci`, ESLint, TypeScript checking, window/history/mock-exception regressions, and static export build; bundle size is reported |
| Backend build, vet, test & lint | `go vet`, golangci-lint, OpenAPI spec sync, and `go test -race -count=1 -coverprofile=coverage.out ./...` with a disposable PostgreSQL service |
| Helm lint | Chart/default/example lint, Python chart regression tests, and strict kubeconform validation of rendered default/example manifests (missing CRD schemas are ignored) |
| Docker build check | Dockerfile lint (hadolint), final `linux/amd64` image build/load, and image smoke test against disposable PostgreSQL |

### Security (`security.yml`)

Triggered on all PRs and pushes to `master`, manual dispatch, and weekly (Monday 06:00 UTC).

| Job | What it checks |
| :-- | :------------- |
| govulncheck | Go dependency vulnerability scan |
| npm audit | Production dependencies only; high/critical findings fail the job |
| Trivy image scan | Container image vulnerabilities gate on fixable high/critical findings; misconfiguration reports are informational |
| Trivy filesystem scan | Dependency vulnerabilities gate on fixable high/critical findings; IaC misconfiguration reports are informational |
| gosec | Go static security analysis uploaded as SARIF; findings do not fail this reporting job |
| TruffleHog | Verified leaked secrets |

All GitHub Actions versions are pinned to full commit SHAs for supply-chain integrity.

---

## Release Process

Releases are fully automated via [release-please](https://github.com/googleapis/release-please).

1. Merge PRs to `master` using conventional commit messages.
2. release-please opens a **Release PR** containing the version bump and changelog diff.
3. Merging the Release PR triggers the release pipeline. `release-please.yml` chains
   the release build via `workflow_call` because `GITHUB_TOKEN`-generated events do not
   trigger other workflows (so a `release: published` trigger would be silently skipped).
   - The `linux/amd64` Docker image is built and pushed to `ghcr.io/macxsimilian/kube-phoenix` with the full semver tag (without the Git tag's leading `v`). Reruns reuse a published image only after validating its release identity.
   - The exact image digest is pulled and smoke-tested against disposable PostgreSQL. The check exercises the image's non-root runtime and built-in healthcheck, database readiness, the embedded backend version, HTML, and a referenced Next.js script.
   - After smoke succeeds, the digest is signed with [cosign](https://github.com/sigstore/cosign) (keyless / OIDC), and an SBOM generated with [Syft](https://github.com/anchore/syft) is attested to it. Stable minor/major aliases and `latest` are then promoted according to the release ordering rules.
   - The Helm chart is pushed to `oci://ghcr.io/macxsimilian/helm/kube-phoenix` only after the Docker job succeeds. A failed smoke test can leave the full version tag published, but prevents signing, alias promotion, and chart publication for that run.

CI, release, and security image builds retain npm, Next.js, Go module, and Go build
cache mounts separately from the BuildKit layer cache. See the
[local build notes](docs/local-development.md#final-image-smoke-check).

Never create Git tags manually -- release-please owns all tags and releases.

### Complete Release Notes

Release-please builds the changelog from Conventional Commit messages. It does not
copy the full pull request description into the release notes. When squash-merging
a PR with several independent fixes, add their Conventional Commit entries as plain
footers at the bottom of the squash commit message, separated by blank lines:

```text
fix!: improve policy editing and bundled database upgrades

fix(policies): persist cleared optional fields

fix(api): retain failed emergency restores for retry

fix(deps)!: upgrade bundled PostgreSQL to 18

BREAKING CHANGE: Restore PostgreSQL 17 data into fresh PostgreSQL 18 storage before upgrading.
```

Do not prefix those footer entries with Markdown bullets. Keep detailed migration
instructions and dependency version tables in the PR description. See the
[release-please guidance for multiple changes](https://github.com/googleapis/release-please#what-if-my-pr-contains-multiple-fixes-or-features).

Before merging a release PR, review its changelog against every PR in the release
range. Confirm that user-facing fixes, breaking behavior, migration steps, and
important dependency upgrades are visible. Maintenance entries such as `docs:`,
`ci:`, and `chore:` are hidden by the default changelog configuration.

For a squash-merged PR whose release is still pending, use the documented
[commit override](https://github.com/googleapis/release-please#how-can-i-fix-release-notes)
in its PR body and let release-please regenerate the notes. For an already published
release, correct its GitHub release description and submit a documentation PR for
the matching `CHANGELOG.md` entry.

---

## Code of Conduct

All participants are expected to treat each other with respect. Constructive criticism
of code and ideas is welcome; personal attacks are not. This project follows standard
open-source conduct guidelines.

---

## Getting Help

- **Bug reports and feature requests** -- [open an issue][issues].
- **Questions and discussions** -- use [GitHub Discussions][discussions].
- **Security concerns** -- report via [GitHub Security Advisories][security].

[security]: https://github.com/MacXsimilian/kube-phoenix/security/advisories/new
[issues]: https://github.com/MacXsimilian/kube-phoenix/issues
[discussions]: https://github.com/MacXsimilian/kube-phoenix/discussions
