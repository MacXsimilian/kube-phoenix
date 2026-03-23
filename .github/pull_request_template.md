## Summary

<!--
What does this PR do and why? Link to a related issue if applicable.
Example: Fixes #123
-->

## Changes

<!--
List the concrete changes introduced by this PR.
-->

-

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactor (code change that neither fixes a bug nor adds a feature)
- [ ] Documentation update
- [ ] CI/CD or build configuration
- [ ] Dependency update

## Checklist

- [ ] `go test ./...` passes locally
- [ ] No new `golangci-lint` warnings
- [ ] Frontend builds cleanly (`npm run build`)
- [ ] OpenAPI spec updated (if API changed) and `make copy-spec` run
- [ ] Documentation updated (README, ARCHITECTURE, docs/) where applicable
- [ ] Helm chart version bumped (if chart changed)
- [ ] No secrets, credentials, or sensitive data committed
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
