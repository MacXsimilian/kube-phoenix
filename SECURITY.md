# Security Policy

## Supported versions

Security fixes are applied to the latest release only. Older versions are not backported.

| Version | Supported |
|---|---|
| Latest (`master`) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use [GitHub private vulnerability reporting](https://github.com/MacXsimilian/kube-phoenix/security/advisories/new) to submit a report confidentially. You will receive a response within 5 business days.

Include as much of the following as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The version or commit where you found the issue
- Any suggested mitigations

## Disclosure policy

1. You report the vulnerability privately.
2. We confirm receipt and assess the impact.
3. We develop and test a fix.
4. We release the fix and publish a GitHub Security Advisory.
5. You are credited in the advisory (unless you prefer to remain anonymous).

We aim to release fixes for critical vulnerabilities within 7 days of confirmed impact, and within 30 days for lower-severity issues.

## Scope

The following are in scope:

- The Go backend (`backend/`)
- The Next.js frontend (`frontend/`)
- The Helm chart (`helm/`)
- The CI/CD workflows (`.github/workflows/`)

The following are out of scope:

- Third-party dependencies (report these to their respective maintainers; Dependabot handles automated updates)
- Vulnerabilities that require physical access to the cluster or cluster-admin privileges that the attacker already possesses

## Security model

kube-phoenix runs as a Kubernetes deployment with a dedicated ServiceAccount. The ClusterRole grants read access to workloads, nodes, and pods, and write access (scale, annotate, cordon, drain, delete) for the scaler operations.

**Principle of least privilege:** the ServiceAccount has no permissions beyond what the scaler requires. Review `helm/kube-phoenix/templates/clusterrole.yaml` for the full set of granted permissions before installing.

**Authentication:** HTTP Basic Auth is enforced on all `/api/*` and `/ws/*` endpoints when `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` are set. Running without these variables set disables authentication entirely — do not do this in production.
