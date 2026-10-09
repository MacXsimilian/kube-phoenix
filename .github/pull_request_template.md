## Summary

<!-- Explain the problem, why it matters, and the resulting behavior in one or two short paragraphs. -->

## Changes

<!-- List concrete changes. Group by area only when useful. -->

-

## Breaking Changes

<!-- Describe behavior, API, configuration, permission, deployment, or tool requirement changes. Write "None." if there are none. -->

## Migration Notes

<!-- Describe required steps, ordering, downtime, and rollback considerations where applicable. Write "No migration required." if none are needed. -->

## Dependency Changes

<!-- Compare previous and updated versions against the PR base in a table. Include relevant build images and CI actions. Identify selected highlights and link to manifests/lockfiles for omitted transitive updates. Write "None." if unchanged. -->

## Related Issues

<!-- Use "Fixes #123" for issues resolved by this PR, or "Related to #123" for context. Otherwise write "Not tied to a tracked issue." -->

## Checklist

<!-- Keep relevant items; remove others or explicitly mark them N/A. Check only verified items. Record commands/results and explain failures, skipped checks, unavailable environments, and earlier validation that does not cover the final revision. Chart version/appVersion updates belong to release-please's release PR. -->

- [ ] Relevant backend tests and lint pass
- [ ] Database reliability tests pass with a disposable `TEST_DATABASE_URL` for store/scheduler changes
- [ ] Frontend lint, typecheck, regression checks, and production build pass for UI changes
- [ ] Helm lint and rendered chart regression checks pass for chart changes
- [ ] Final-image smoke check passes for Docker or embedded asset changes
- [ ] Changed behavior has appropriate regression coverage
- [ ] OpenAPI spec updated for API changes and both copies synchronized with `make copy-spec`
- [ ] Documentation and migration instructions updated where applicable
- [ ] No secrets, credentials, or sensitive data committed
- [ ] Commit messages follow Conventional Commits; breaking changes and release entries are preserved in the squash commit
- [ ] Required GitHub checks pass
