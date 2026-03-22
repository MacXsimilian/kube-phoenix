# Changelog

## [0.3.0](https://github.com/MacXsimilian/kube-phoenix/compare/v0.2.0...v0.3.0) (2026-03-22)


### ⚠ BREAKING CHANGES

* /api/schedules, /api/executions, /api/trigger, and /ws/executions endpoints are removed. Use /api/policies instead.

### Features

* window-based policies, remove legacy schedules ([#197](https://github.com/MacXsimilian/kube-phoenix/issues/197)) ([a03e7fe](https://github.com/MacXsimilian/kube-phoenix/commit/a03e7fe1b9375ec54caa556baf2007426a002424))

## [0.2.0](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.82...v0.2.0) (2026-03-22)


### ⚠ BREAKING CHANGES

* /api/schedules, /api/executions, /api/trigger, and /ws/executions endpoints are removed. Use /api/policies instead.

### Features

* window-based policies, remove legacy schedules, audit fixes ([#194](https://github.com/MacXsimilian/kube-phoenix/issues/194)) ([c21310e](https://github.com/MacXsimilian/kube-phoenix/commit/c21310ed0c1512eb7bfdb666a3d1b18d44d5a0d3))

## [0.1.82](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.81...v0.1.82) (2026-03-22)


### Features

* **policies:** policy-based sleep/wake model with exceptions and overrides ([#192](https://github.com/MacXsimilian/kube-phoenix/issues/192)) ([e860b36](https://github.com/MacXsimilian/kube-phoenix/commit/e860b36fd071c9044e5b724b45fd25986fc53187))

## [Unreleased]

### Features

* **policy:** unified sleep/wake policy model with DB-backed snapshots, overrides, scheduled exceptions, and startup recovery
  * `Policy` entity replaces paired `scale_down`/`scale_up` schedules — one object declares `sleepCron`, `wakeCron`, namespace/label targeting, mode, and timeout
  * `PolicyScheduler` — per-policy robfig/cron entries, startup recovery (IntendedState vs currentState), exception tick loop (every minute)
  * `PolicyEngine` — pure evaluation: `IntendedState`, `NextFire`, `MostRecentFire` (forward-scan workaround for cron lacking `Prev()`)
  * `PolicyScaler` — DB-backed `WorkloadSnapshot` rows; double-sleep guard; belt-and-suspenders K8s annotation fallback on wake
  * Overrides: `stay_awake`, `force_sleep` (windowed) + `skip_sleep`, `skip_wake` (one-shot); precedence: force_sleep > stay_awake > skip > cron
  * Scheduled Exceptions: future one-time windows with ticket refs, `pending → active → completed` lifecycle, `sleepOnEnd` flag
  * 22 new API endpoints under `/api/policies`, `/api/policy-executions`, `/api/exceptions`
  * WebSocket live log streaming at `/ws/policy-executions/{id}/logs`
  * Frontend: Policies page, policy detail page (overrides, exceptions, execution history), Exceptions page, PolicyCard component with state badge

---

## [0.1.81](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.80...v0.1.81) (2026-03-22)


### Performance Improvements

* **frontend:** performance and code quality audit fixes ([8b34ccc](https://github.com/MacXsimilian/kube-phoenix/commit/8b34ccc354f84431743c268c6af4a9a4bebfe767))

## [0.1.80](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.79...v0.1.80) (2026-03-22)


### Features

* **oidc:** RP-initiated logout to terminate Keycloak session ([#180](https://github.com/MacXsimilian/kube-phoenix/issues/180)) ([af457f2](https://github.com/MacXsimilian/kube-phoenix/commit/af457f2aa1e0e7d9cc0c3d681e903a181fca21d3))


### Bug Fixes

* startup recovery, namespace validation, OIDC TLS warning ([#181](https://github.com/MacXsimilian/kube-phoenix/issues/181)) ([6589c42](https://github.com/MacXsimilian/kube-phoenix/commit/6589c422e3869bbcc23b2c923cbff478347ad27b))

## [0.1.79](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.78...v0.1.79) (2026-03-21)


### Features

* **oidc:** user profile sync, DB hardening, API docs overhaul ([#176](https://github.com/MacXsimilian/kube-phoenix/issues/176)) ([86ce483](https://github.com/MacXsimilian/kube-phoenix/commit/86ce48343b3922d53d5b7ec84ca3362430ac0255))


### Bug Fixes

* rebuild CHANGELOG.md — remove duplicates from non-squashed merges ([18d3033](https://github.com/MacXsimilian/kube-phoenix/commit/18d3033913d3dfe86d3f962c73df4dc411f8afdc))

## [0.1.78](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.76...v0.1.78) (2026-03-21)


### Bug Fixes

* **oidc:** correct OIDCSubject column name ([#172](https://github.com/MacXsimilian/kube-phoenix/issues/172)) ([44f0313](https://github.com/MacXsimilian/kube-phoenix/commit/44f03131efd2171b0870d9f0d8372dfb67e70799))

## [0.1.76](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.75...v0.1.76) (2026-03-21)


### Bug Fixes

* **oidc:** separate local and OIDC user accounts ([#170](https://github.com/MacXsimilian/kube-phoenix/issues/170)) ([35d7e0b](https://github.com/MacXsimilian/kube-phoenix/commit/35d7e0b4023dc72bdd1ca2ab24e804bb5fbdf8eb))

## [0.1.75](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.74...v0.1.75) (2026-03-21)


### Bug Fixes

* **oidc:** use proper PKCE verifier instead of reusing state ([#167](https://github.com/MacXsimilian/kube-phoenix/issues/167)) ([5da7e9f](https://github.com/MacXsimilian/kube-phoenix/commit/5da7e9f06b32d0ca5c3d9881f92472c545505edd))

## [0.1.74](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.73...v0.1.74) (2026-03-21)

### Features

* **oidc:** add TLS skip verify and custom CA cert support ([a39ce1a](https://github.com/MacXsimilian/kube-phoenix/commit/a39ce1ab7591f3101d474fe6a43aaae846c094a6))

## [0.1.73](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.72...v0.1.73) (2026-03-21)

### Features

* **db:** upgrade PostgreSQL from 16 to 17.7 ([4e827a8](https://github.com/MacXsimilian/kube-phoenix/commit/4e827a8d49091a2416653c4c30e65ed520bca36a))

### Bug Fixes

* **ci:** fix backend test GITHUB_OUTPUT format error ([e427658](https://github.com/MacXsimilian/kube-phoenix/commit/e427658b439b831f5ad62951ff292ab9c48bff69))
* **ci:** fix govulncheck GITHUB_OUTPUT format error ([79662f5](https://github.com/MacXsimilian/kube-phoenix/commit/79662f5748434d9e1a98627bcc62de21408c619f))
* **ui:** WCAG AA light mode colors + settings layout tweaks ([6baa8bf](https://github.com/MacXsimilian/kube-phoenix/commit/6baa8bf9183ae2f6f216f44fe5d97f94a4f42a23))

## [0.1.72](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.71...v0.1.72) (2026-03-20)

### Features

* **build:** add BuildKit cache mounts and Docker CI validation ([8239829](https://github.com/MacXsimilian/kube-phoenix/commit/8239829583c72c4725f3ebc4bbcd4966d58458bb))

## [0.1.71](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.70...v0.1.71) (2026-03-20)

### Features

* **settings:** add OIDC config status checker ([1e038af](https://github.com/MacXsimilian/kube-phoenix/commit/1e038af460f3b62949a63861c46a755dba554235))

## [0.1.70](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.69...v0.1.70) (2026-03-20)

### Features

* **helm:** harden chart with missing production features ([57aa120](https://github.com/MacXsimilian/kube-phoenix/commit/57aa120f31b96b4202e25bf1837b6368969a859d))

## [0.1.69](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.68...v0.1.69) (2026-03-20)

### Features

* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([634bffa](https://github.com/MacXsimilian/kube-phoenix/commit/634bffaae06f31db31274b4b6bfa72c083395050))
* add preventive RBAC UI guards on all mutation buttons ([90aaadb](https://github.com/MacXsimilian/kube-phoenix/commit/90aaadb30be2bc220eeadc78fc81ae22dd809c77))

### Bug Fixes

* return clear permission-denied message on 403 ([78e244c](https://github.com/MacXsimilian/kube-phoenix/commit/78e244cfe2dde95e825a791ff25550c9dc7c2102))
* use NewRequestWithContext in auth tests (noctx lint) ([2b2ba4d](https://github.com/MacXsimilian/kube-phoenix/commit/2b2ba4d1f06ecacfcf1a8b3fe1e0537d69977556))

## [0.1.68](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.67...v0.1.68) (2026-03-17)

### Features

* **cluster:** add streaming pod log viewer to pod detail ([899bb8c](https://github.com/MacXsimilian/kube-phoenix/commit/899bb8c773593e4c9de9e8546cd80a1ef17e0289))

## [0.1.67](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.66...v0.1.67) (2026-03-17)

### Features

* add streaming pod log viewer to cluster drawer ([f381091](https://github.com/MacXsimilian/kube-phoenix/commit/f381091a1c1e9808c2c5fa5ddeca47b37922e54a))

### Bug Fixes

* check stream.Close error return to satisfy errcheck linter ([5b4b61f](https://github.com/MacXsimilian/kube-phoenix/commit/5b4b61f939d329e579426dc528dcf7261be3b88c))

## [0.1.66](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.65...v0.1.66) (2026-03-16)

### Bug Fixes

* gofmt -s formatting and update stale version refs in docs ([bbbabf0](https://github.com/MacXsimilian/kube-phoenix/commit/bbbabf0ad3356ef993bae48693a033193f8ce13e))

## [0.1.65](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.64...v0.1.65) (2026-03-16)


### Bug Fixes

* **ci:** audit fixes across all workflows ([eb30eb2](https://github.com/MacXsimilian/kube-phoenix/commit/eb30eb2481a42361221264e6e0c713d6ec54825b))
* **ci:** skip SARIF upload when Trivy output file is missing ([4cb328b](https://github.com/MacXsimilian/kube-phoenix/commit/4cb328b20c61f8cf64ac3cb9ea034b803e9b4aa9))
* **ci:** use valid codeql-action SHA for SARIF upload ([0682a17](https://github.com/MacXsimilian/kube-phoenix/commit/0682a17fedc4856dbcf669d7759a15866bd3cb9d))

## [0.1.64](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.63...v0.1.64) (2026-03-16)


### Bug Fixes

* **api:** align handlers with camelCase JSON convention ([5f1f87a](https://github.com/MacXsimilian/kube-phoenix/commit/5f1f87a0b84e0fac95d73644611039dfe1de41a0))
* **ci:** align versions, add caching and timeouts ([99d370d](https://github.com/MacXsimilian/kube-phoenix/commit/99d370d0edca8f59cd51d83a4ab1aa52041a10c5))
* **helm:** harden security and add missing templates ([909d475](https://github.com/MacXsimilian/kube-phoenix/commit/909d475b3fccadc1ae47795567cc71ddae360c9c))
* **openapi:** rewrite spec to match actual API behavior ([d5baa34](https://github.com/MacXsimilian/kube-phoenix/commit/d5baa3459bb02c8fcb72b96092bd41fa6828be2a))

## [0.1.63](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.62...v0.1.63) (2026-03-16)

### Features

* replace cron text field with visual CronBuilder in schedule dialog ([53f4d8a](https://github.com/MacXsimilian/kube-phoenix/commit/53f4d8a2413febb5c33c6ad3097f66967dcd74b2))

### Bug Fixes

* revert embedded openapi.yaml tracking; add CI sync assertion ([b47f7ea](https://github.com/MacXsimilian/kube-phoenix/commit/b47f7ea7b733a8db07d4bc0b53e7ba41c918508b))
* track embedded openapi.yaml so go:embed resolves on CI ([9ce583e](https://github.com/MacXsimilian/kube-phoenix/commit/9ce583e14c01ce690df69d78311198285cc9aa6e))

## [0.1.62](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.61...v0.1.62) (2026-03-16)

### Features

* add Prometheus metrics endpoint at /metrics ([61a2d0e](https://github.com/MacXsimilian/kube-phoenix/commit/61a2d0efea777ea4b6819a0e1ca573521eda8db5))

### Bug Fixes

* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([e31bce4](https://github.com/MacXsimilian/kube-phoenix/commit/e31bce4b7d864a790343f217107f20bdc3a7f90d))

## [0.1.61](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.60...v0.1.61) (2026-03-16)

### Bug Fixes

* add WWW-Authenticate header so browsers prompt for credentials ([e7f3e1e](https://github.com/MacXsimilian/kube-phoenix/commit/e7f3e1e00d5633c1a636034b8b829077df33692a))

## [0.1.60](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.59...v0.1.60) (2026-03-16)


### Features

* serve Swagger UI at /api/docs/ ([534022a](https://github.com/MacXsimilian/kube-phoenix/commit/534022a5b7be88c9fcef86b4fee562079a757bcb))


### Bug Fixes

* address senior engineer audit of swagger UI ([bda295b](https://github.com/MacXsimilian/kube-phoenix/commit/bda295b28c91dcf3329b216d499882ffed2265dd))

## [0.1.59](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.58...v0.1.59) (2026-03-15)

### Bug Fixes

* **metrics:** log HTTP status code on metrics API failure ([90f840e](https://github.com/MacXsimilian/kube-phoenix/commit/90f840e0853289ff0ad5766603d6e3d9bf6c8ffa))

## [0.1.58](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.57...v0.1.58) (2026-03-15)

### Bug Fixes

* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([f3914d4](https://github.com/MacXsimilian/kube-phoenix/commit/f3914d4978aba4a33d387527d9f5e7fc3d61ad8d))

## [0.1.57](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.56...v0.1.57) (2026-03-15)

### Features

* **cluster:** show actual CPU/mem usage in node and workload pod lists ([8c661d4](https://github.com/MacXsimilian/kube-phoenix/commit/8c661d4491d629be65e17cb16e865369f09a54df))

## [0.1.56](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.55...v0.1.56) (2026-03-15)


### Bug Fixes

* **ui:** rework light mode — fix all hardcoded dark colors ([f38ba65](https://github.com/MacXsimilian/kube-phoenix/commit/f38ba65b0fa262e826e809f5ea6c614a323d6ee4))

## [0.1.55](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.54...v0.1.55) (2026-03-15)

### Features

* **schedules:** drag-and-drop reordering persisted per schedule type ([b41f643](https://github.com/MacXsimilian/kube-phoenix/commit/b41f643490699acb6475c4f6b463168cfb291795))

### Bug Fixes

* **overview:** equal-height cards + update docs for reorder and position field ([006d221](https://github.com/MacXsimilian/kube-phoenix/commit/006d221224e448f58559928dbee9a731bb278b58))
* **schedules:** move dnd modifiers to correct package ([6a283eb](https://github.com/MacXsimilian/kube-phoenix/commit/6a283eb8287c479181315044be73c6d24014b194))

## [0.1.54](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.53...v0.1.54) (2026-03-15)

### Bug Fixes

* **security:** redact WS token from logs, fix RBAC replicasets, add reset-db audit log ([2409917](https://github.com/MacXsimilian/kube-phoenix/commit/240991749e8cfb3e31e2d10ae626d3c819775c28))

## [0.1.53](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.52...v0.1.53) (2026-03-15)

### Bug Fixes

* input validation, error sanitisation, and CORS hardening ([e3e4ad7](https://github.com/MacXsimilian/kube-phoenix/commit/e3e4ad76dc316e265caee478df6d6692175da64f))

## [0.1.52](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.51...v0.1.52) (2026-03-15)

### Bug Fixes

* cache invalidation gaps, error handling, and UX improvements ([e118ddc](https://github.com/MacXsimilian/kube-phoenix/commit/e118ddcbd6372eb2f946ebca9248e563a9dc3fb3))

## [0.1.51](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.50...v0.1.51) (2026-03-15)

### Bug Fixes

* address audit findings — logging, WS goroutine leak, scaler drain safety, count persistence ([8816975](https://github.com/MacXsimilian/kube-phoenix/commit/88169751119ea127ab8414a5e758bfbbdb2c5ee1))

## [0.1.50](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.49...v0.1.50) (2026-03-15)


### Bug Fixes

* **formatters:** timeUntil now formats days for countdowns over 24 h ([5d309a2](https://github.com/MacXsimilian/kube-phoenix/commit/5d309a2b13007ac552aed746242f841b7d099010))

## [0.1.49](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.48...v0.1.49) (2026-03-15)

### Features

* add light/dark/system theme mode switcher ([bbf520e](https://github.com/MacXsimilian/kube-phoenix/commit/bbf520e83f38043b75e4a1fa98c35baf04a64044))

## [0.1.48](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.47...v0.1.48) (2026-03-15)

### Bug Fixes

* **formatters:** timeUntil now formats days for countdowns over 24 h ([d3fa6a7](https://github.com/MacXsimilian/kube-phoenix/commit/d3fa6a77a06fc40e4351837173dec2a5e9ab0528))

## [0.1.47](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.46...v0.1.47) (2026-03-15)

### Features

* **schedules:** add inline toggle feedback — spinner, Saved label, Failed state ([578ef88](https://github.com/MacXsimilian/kube-phoenix/commit/578ef8837282b869ccc7b8fdf69c2f09d418459e))

## [0.1.46](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.45...v0.1.46) (2026-03-15)

### Features

* add About modal triggered from kube-phoenix title ([fd24da4](https://github.com/MacXsimilian/kube-phoenix/commit/fd24da4cc74c29739a26ddf1f67169b00f10b2f2))
* branded login screen, nav reorder, inline log drawer, and docs ([9e92e30](https://github.com/MacXsimilian/kube-phoenix/commit/9e92e304d88f2737c0ef5a99452b58290906928d))
* **cluster:** node pod drawer, workload kind labels, chart version sync ([13ea6e0](https://github.com/MacXsimilian/kube-phoenix/commit/13ea6e05a7483eec94843a74627a4b6c4a4644d5))
* **cluster:** pod detail and workload detail drawers ([2021523](https://github.com/MacXsimilian/kube-phoenix/commit/2021523c7ab175c9a65e5faf6ec8932f1aacfe57))
* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([92f4a24](https://github.com/MacXsimilian/kube-phoenix/commit/92f4a2426a684867acb22659d0053c6c7d584662))
* custom auth UI, pod metrics, and cluster detail improvements ([be9092d](https://github.com/MacXsimilian/kube-phoenix/commit/be9092df93d04fbee6ba83654bfbf6410673540f))
* **frontend:** resizable log drawer with drag handle ([2c4fe22](https://github.com/MacXsimilian/kube-phoenix/commit/2c4fe22bd748ace44d4ffb7c0ae017c40148c778))
* **frontend:** responsive layout with collapsible sidebar ([e0f2e4a](https://github.com/MacXsimilian/kube-phoenix/commit/e0f2e4af82a15f660fcdbe99ecf8db04acdcfdb3))
* **frontend:** UI improvements, bug fixes, and cluster state enhancements ([8b95920](https://github.com/MacXsimilian/kube-phoenix/commit/8b95920b6bb22408b3af4db467fccadc7c84018e))
* **frontend:** UX improvements and README overhaul ([af1490f](https://github.com/MacXsimilian/kube-phoenix/commit/af1490fbbcdb7fcb8762e9b7cde326d47419369f))
* **guardrails:** system-protected namespaces with deletion confirmation ([3b266fa](https://github.com/MacXsimilian/kube-phoenix/commit/3b266faead3242f3fbeb49d7f413a30cfaff592f))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([f2a0c9d](https://github.com/MacXsimilian/kube-phoenix/commit/f2a0c9da965b05981c89e1deb00b0f158e3ec292))
* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([b2dc9b5](https://github.com/MacXsimilian/kube-phoenix/commit/b2dc9b56d249e9be0a83439b876a969a43e452ec))
* **overview:** next-run countdown, partial state, deep-link activity feed ([3c642a3](https://github.com/MacXsimilian/kube-phoenix/commit/3c642a39a6fa997f4f367a9d5de804800495cf4b))
* **overview:** remove Schedules card, fix activity feed UX, add README badges ([94d3b60](https://github.com/MacXsimilian/kube-phoenix/commit/94d3b60ce459c75e715dbe41b0dbcb3659749da4))
* **settings:** add Reset Database with two-step confirmation ([fc9e0b7](https://github.com/MacXsimilian/kube-phoenix/commit/fc9e0b71bbbde4bda27c7388ec19965405d35615))
* **ui:** add phoenix emoji favicon ([43fa1db](https://github.com/MacXsimilian/kube-phoenix/commit/43fa1db55fb813ccbeddb5e698bd0108d856ea7b))
* **ui:** execution summary, db reset stream, and UX improvements ([bf87def](https://github.com/MacXsimilian/kube-phoenix/commit/bf87defdc979b20817eefa5106cd782ceaa649da))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([acb4f26](https://github.com/MacXsimilian/kube-phoenix/commit/acb4f269738cc0dabcab32feb13093e52090bcd0))

### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* **backend:** check fmt.Fprintf error in SSE handler ([ba0cc1c](https://github.com/MacXsimilian/kube-phoenix/commit/ba0cc1c9814eb3c7b9e86c799a0b0c673ee79b2a))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([7be22a3](https://github.com/MacXsimilian/kube-phoenix/commit/7be22a37fe01b9adab20fdd392a50a8c28a058df))
* check json.Encode error in createSchedule 201 response ([b072745](https://github.com/MacXsimilian/kube-phoenix/commit/b07274510338ac3eae25a7484d51b487795d7e2e))
* **ci:** bump Go to 1.25.8 to patch GO-2026-4601 and GO-2026-4602 ([e238cf2](https://github.com/MacXsimilian/kube-phoenix/commit/e238cf2b469f2bdf7a0b5edd2f95c9e786aa0b15))
* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([a0e3525](https://github.com/MacXsimilian/kube-phoenix/commit/a0e3525dee262b6eeb19b97635d14ef69881625a))
* **ci:** exclude gosec G706 false positive for structured slog calls ([b21bd56](https://github.com/MacXsimilian/kube-phoenix/commit/b21bd5630312ff77bbc325f7bbff3c1ad86013ac))
* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([30d2132](https://github.com/MacXsimilian/kube-phoenix/commit/30d21329799d5f54d0c0a50dc6d0654a1df03dad))
* **ci:** restore go-version to 1.25 to match go.mod ([5f98541](https://github.com/MacXsimilian/kube-phoenix/commit/5f98541a349fa58fb62cb97d268e41ec0f66d847))
* **ci:** revert to npm install until package-lock.json is committed ([d2e4fba](https://github.com/MacXsimilian/kube-phoenix/commit/d2e4fba4583d25f2c4f0df2a1e3939e7379eb194))
* **ci:** run secret scan on push and PRs, not PRs only ([cd4dde5](https://github.com/MacXsimilian/kube-phoenix/commit/cd4dde5e4a05bb5b39d9cefbc3ba8ca4bc62adc4))
* **cluster:** add React import for React.Fragment in NodeDetailDrawer ([dc62fba](https://github.com/MacXsimilian/kube-phoenix/commit/dc62fbac4682cd3344c80017b06935d6398ef12a))
* **font:** self-host Inter via next/font — no runtime CDN requests ([b04fe6b](https://github.com/MacXsimilian/kube-phoenix/commit/b04fe6bd9cc1c9c3f8de21ecf83e33a2bb7e47d8))
* **frontend:** address UI audit findings ([82d1fa7](https://github.com/MacXsimilian/kube-phoenix/commit/82d1fa7aff11878f09811574a39ffb8a673de90d))
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([fecb639](https://github.com/MacXsimilian/kube-phoenix/commit/fecb63929beb0739d647946639b2cdb3674621ce))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([567fde6](https://github.com/MacXsimilian/kube-phoenix/commit/567fde6c29714dd5eb912f8a5b0656c688bfaeed))
* **frontend:** surface silent mutation/query failures across all components ([cf075b3](https://github.com/MacXsimilian/kube-phoenix/commit/cf075b37ff58725fd7e64ed3a8d31e0b11b10424))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([a252a53](https://github.com/MacXsimilian/kube-phoenix/commit/a252a53d765e22f75e09e4625855e9d5e88ded78))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* **helm:** sync chart version to 0.1.17 ([942d113](https://github.com/MacXsimilian/kube-phoenix/commit/942d11313fe7a50b2a48f94914d63fc3ea8f45e0))
* history UX corrections and browser native auth popup ([15378a9](https://github.com/MacXsimilian/kube-phoenix/commit/15378a9ce931601ea238b24643d73b28b022a6a5))
* **history:** cast Box ref type to HTMLElement in LogViewer ([09cedcd](https://github.com/MacXsimilian/kube-phoenix/commit/09cedcdfe86e4576cf472c59ad80d05e6a3c14d5))
* **history:** show correct arrow direction and hide drained chip for wake executions ([e9866b7](https://github.com/MacXsimilian/kube-phoenix/commit/e9866b7721cc61e39ddabb5ae205e9bfc8b97c7a))
* **layout:** remove double margin-left pushing content off-center ([8e9af3f](https://github.com/MacXsimilian/kube-phoenix/commit/8e9af3f2306be0812ba0a28c7bdbe7cd969c629b))
* **logviewer:** remove log count badge, fix scroll and jump-to-error ([ae66a7b](https://github.com/MacXsimilian/kube-phoenix/commit/ae66a7bae2145bce4c9b0746272db4eec89f0654))
* **logviewer:** summary closed by default, logs in collapsible accordion open by default ([8ae1347](https://github.com/MacXsimilian/kube-phoenix/commit/8ae13477a01a709062ae5e4805ec203b8f06f39f))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([962ae8c](https://github.com/MacXsimilian/kube-phoenix/commit/962ae8c2f1fcba14129a34ed99b027a904276de1))
* migrate release-please to googleapis/release-please-action v4.4.0 ([42a2b79](https://github.com/MacXsimilian/kube-phoenix/commit/42a2b792c24bb4be972c6b186cbfa83115009f12))
* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([3b4c8b5](https://github.com/MacXsimilian/kube-phoenix/commit/3b4c8b511f99ae9e681c004e7c7c59ca2a8459ed))
* **overview:** open log drawer after trigger instead of navigating to history ([e9866b7](https://github.com/MacXsimilian/kube-phoenix/commit/e9866b7721cc61e39ddabb5ae205e9bfc8b97c7a))
* **overview:** pin time indicator to right edge in activity feed, fix wake label ([ae89107](https://github.com/MacXsimilian/kube-phoenix/commit/ae89107ee9450d733783099c7a43aac4e0235014))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* pull About modal version from package.json instead of hardcoding ([78c697b](https://github.com/MacXsimilian/kube-phoenix/commit/78c697bb41f79494f21882084a207f017002cf19))
* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([81cf0b3](https://github.com/MacXsimilian/kube-phoenix/commit/81cf0b3470f6c8828533bb9a56a450a9cc000552))
* **release:** run docker build and helm publish inside release-please workflow ([01f5001](https://github.com/MacXsimilian/kube-phoenix/commit/01f5001a40c04868180d8f1f2e9d47835930d153))
* remove npm cache — no package-lock.json in repo ([c945c26](https://github.com/MacXsimilian/kube-phoenix/commit/c945c26247ba9c68ce5696f09a17384ccbd66181))
* replace release-please action with npx CLI to avoid action policy restriction ([e7855a0](https://github.com/MacXsimilian/kube-phoenix/commit/e7855a0a1b03f0350827145949179ce1c1e44065))
* resolve all errcheck lint findings ([05743c8](https://github.com/MacXsimilian/kube-phoenix/commit/05743c87fd29e64578bf529bc7f205caca422f28))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([8743f78](https://github.com/MacXsimilian/kube-phoenix/commit/8743f7864b7d627b484fd9db5717946704705b72))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([c7dcf8f](https://github.com/MacXsimilian/kube-phoenix/commit/c7dcf8f9cfbed6b172e4a2353c0cd132b5b2f34a))
* **scaler:** align scale_down with original cronjob logic ([90c1ed7](https://github.com/MacXsimilian/kube-phoenix/commit/90c1ed7e124ba8ca8e37b471630a1f89763572e8))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([86b3a82](https://github.com/MacXsimilian/kube-phoenix/commit/86b3a82e95524644e9c0ffdb5d3918948a8abd84))
* **schedules:** resolve stale closure causing toggle not to persist ([1171b6a](https://github.com/MacXsimilian/kube-phoenix/commit/1171b6aa5458c0ab9e14081c6e45e8f0fd1297fc))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))
* wrap ActivityFeed siblings in Fragment to resolve JSX syntax error ([74c1eb2](https://github.com/MacXsimilian/kube-phoenix/commit/74c1eb20855d50be76e1300338e670ffb992c962))

### Performance Improvements

* **overview:** cluster cache, SSE stream, and overview endpoint ([9536a91](https://github.com/MacXsimilian/kube-phoenix/commit/9536a91630318533628925fb0ed9166b2b0bb27b))

## [0.1.44](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.43...v0.1.44) (2026-03-15)


### Bug Fixes

* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([86b3a82](https://github.com/MacXsimilian/kube-phoenix/commit/86b3a82e95524644e9c0ffdb5d3918948a8abd84))

## [0.1.43](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.42...v0.1.43) (2026-03-15)

### Bug Fixes

* **backend:** check fmt.Fprintf error in SSE handler ([ba0cc1c](https://github.com/MacXsimilian/kube-phoenix/commit/ba0cc1c9814eb3c7b9e86c799a0b0c673ee79b2a))

### Performance Improvements

* **overview:** cluster cache, SSE stream, and overview endpoint ([9536a91](https://github.com/MacXsimilian/kube-phoenix/commit/9536a91630318533628925fb0ed9166b2b0bb27b))

## [0.1.42](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.41...v0.1.42) (2026-03-15)


### Features

* **guardrails:** system-protected namespaces with deletion confirmation ([3b266fa](https://github.com/MacXsimilian/kube-phoenix/commit/3b266faead3242f3fbeb49d7f413a30cfaff592f))

## [0.1.41](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.40...v0.1.41) (2026-03-15)


### Features

* add About modal triggered from kube-phoenix title ([fd24da4](https://github.com/MacXsimilian/kube-phoenix/commit/fd24da4cc74c29739a26ddf1f67169b00f10b2f2))


### Bug Fixes

* pull About modal version from package.json instead of hardcoding ([78c697b](https://github.com/MacXsimilian/kube-phoenix/commit/78c697bb41f79494f21882084a207f017002cf19))

## [0.1.40](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.39...v0.1.40) (2026-03-15)

### Bug Fixes

* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([fecb639](https://github.com/MacXsimilian/kube-phoenix/commit/fecb63929beb0739d647946639b2cdb3674621ce))

## [0.1.39](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.38...v0.1.39) (2026-03-15)

### Bug Fixes

* history UX corrections and browser native auth popup ([15378a9](https://github.com/MacXsimilian/kube-phoenix/commit/15378a9ce931601ea238b24643d73b28b022a6a5))

## [0.1.38](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.37...v0.1.38) (2026-03-14)


### Bug Fixes

* **logviewer:** remove log count badge, fix scroll and jump-to-error ([ae66a7b](https://github.com/MacXsimilian/kube-phoenix/commit/ae66a7bae2145bce4c9b0746272db4eec89f0654))

## [0.1.37](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.36...v0.1.37) (2026-03-14)


### Bug Fixes

* **history:** show correct arrow direction and hide drained chip for wake executions ([e9866b7](https://github.com/MacXsimilian/kube-phoenix/commit/e9866b7721cc61e39ddabb5ae205e9bfc8b97c7a))
* **logviewer:** summary closed by default, logs in collapsible accordion open by default ([8ae1347](https://github.com/MacXsimilian/kube-phoenix/commit/8ae13477a01a709062ae5e4805ec203b8f06f39f))
* **overview:** open log drawer after trigger instead of navigating to history ([e9866b7](https://github.com/MacXsimilian/kube-phoenix/commit/e9866b7721cc61e39ddabb5ae205e9bfc8b97c7a))
* **overview:** pin time indicator to right edge in activity feed, fix wake label ([ae89107](https://github.com/MacXsimilian/kube-phoenix/commit/ae89107ee9450d733783099c7a43aac4e0235014))

## [0.1.36](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.35...v0.1.36) (2026-03-14)


### Features

* branded login screen, nav reorder, inline log drawer, and docs ([9e92e30](https://github.com/MacXsimilian/kube-phoenix/commit/9e92e304d88f2737c0ef5a99452b58290906928d))
* **cluster:** node pod drawer, workload kind labels, chart version sync ([13ea6e0](https://github.com/MacXsimilian/kube-phoenix/commit/13ea6e05a7483eec94843a74627a4b6c4a4644d5))
* **cluster:** pod detail and workload detail drawers ([2021523](https://github.com/MacXsimilian/kube-phoenix/commit/2021523c7ab175c9a65e5faf6ec8932f1aacfe57))
* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([92f4a24](https://github.com/MacXsimilian/kube-phoenix/commit/92f4a2426a684867acb22659d0053c6c7d584662))
* custom auth UI, pod metrics, and cluster detail improvements ([be9092d](https://github.com/MacXsimilian/kube-phoenix/commit/be9092df93d04fbee6ba83654bfbf6410673540f))
* **frontend:** resizable log drawer with drag handle ([2c4fe22](https://github.com/MacXsimilian/kube-phoenix/commit/2c4fe22bd748ace44d4ffb7c0ae017c40148c778))
* **frontend:** responsive layout with collapsible sidebar ([e0f2e4a](https://github.com/MacXsimilian/kube-phoenix/commit/e0f2e4af82a15f660fcdbe99ecf8db04acdcfdb3))
* **frontend:** UI improvements, bug fixes, and cluster state enhancements ([8b95920](https://github.com/MacXsimilian/kube-phoenix/commit/8b95920b6bb22408b3af4db467fccadc7c84018e))
* **frontend:** UX improvements and README overhaul ([af1490f](https://github.com/MacXsimilian/kube-phoenix/commit/af1490fbbcdb7fcb8762e9b7cde326d47419369f))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([f2a0c9d](https://github.com/MacXsimilian/kube-phoenix/commit/f2a0c9da965b05981c89e1deb00b0f158e3ec292))
* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([b2dc9b5](https://github.com/MacXsimilian/kube-phoenix/commit/b2dc9b56d249e9be0a83439b876a969a43e452ec))
* **overview:** next-run countdown, partial state, deep-link activity feed ([3c642a3](https://github.com/MacXsimilian/kube-phoenix/commit/3c642a39a6fa997f4f367a9d5de804800495cf4b))
* **overview:** remove Schedules card, fix activity feed UX, add README badges ([94d3b60](https://github.com/MacXsimilian/kube-phoenix/commit/94d3b60ce459c75e715dbe41b0dbcb3659749da4))
* **settings:** add Reset Database with two-step confirmation ([fc9e0b7](https://github.com/MacXsimilian/kube-phoenix/commit/fc9e0b71bbbde4bda27c7388ec19965405d35615))
* **ui:** add phoenix emoji favicon ([43fa1db](https://github.com/MacXsimilian/kube-phoenix/commit/43fa1db55fb813ccbeddb5e698bd0108d856ea7b))
* **ui:** execution summary, db reset stream, and UX improvements ([bf87def](https://github.com/MacXsimilian/kube-phoenix/commit/bf87defdc979b20817eefa5106cd782ceaa649da))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([acb4f26](https://github.com/MacXsimilian/kube-phoenix/commit/acb4f269738cc0dabcab32feb13093e52090bcd0))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([7be22a3](https://github.com/MacXsimilian/kube-phoenix/commit/7be22a37fe01b9adab20fdd392a50a8c28a058df))
* check json.Encode error in createSchedule 201 response ([b072745](https://github.com/MacXsimilian/kube-phoenix/commit/b07274510338ac3eae25a7484d51b487795d7e2e))
* **ci:** bump Go to 1.25.8 to patch GO-2026-4601 and GO-2026-4602 ([e238cf2](https://github.com/MacXsimilian/kube-phoenix/commit/e238cf2b469f2bdf7a0b5edd2f95c9e786aa0b15))
* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([a0e3525](https://github.com/MacXsimilian/kube-phoenix/commit/a0e3525dee262b6eeb19b97635d14ef69881625a))
* **ci:** exclude gosec G706 false positive for structured slog calls ([b21bd56](https://github.com/MacXsimilian/kube-phoenix/commit/b21bd5630312ff77bbc325f7bbff3c1ad86013ac))
* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([30d2132](https://github.com/MacXsimilian/kube-phoenix/commit/30d21329799d5f54d0c0a50dc6d0654a1df03dad))
* **ci:** restore go-version to 1.25 to match go.mod ([5f98541](https://github.com/MacXsimilian/kube-phoenix/commit/5f98541a349fa58fb62cb97d268e41ec0f66d847))
* **ci:** revert to npm install until package-lock.json is committed ([d2e4fba](https://github.com/MacXsimilian/kube-phoenix/commit/d2e4fba4583d25f2c4f0df2a1e3939e7379eb194))
* **ci:** run secret scan on push and PRs, not PRs only ([cd4dde5](https://github.com/MacXsimilian/kube-phoenix/commit/cd4dde5e4a05bb5b39d9cefbc3ba8ca4bc62adc4))
* **cluster:** add React import for React.Fragment in NodeDetailDrawer ([dc62fba](https://github.com/MacXsimilian/kube-phoenix/commit/dc62fbac4682cd3344c80017b06935d6398ef12a))
* **font:** self-host Inter via next/font — no runtime CDN requests ([b04fe6b](https://github.com/MacXsimilian/kube-phoenix/commit/b04fe6bd9cc1c9c3f8de21ecf83e33a2bb7e47d8))
* **frontend:** address UI audit findings ([82d1fa7](https://github.com/MacXsimilian/kube-phoenix/commit/82d1fa7aff11878f09811574a39ffb8a673de90d))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([567fde6](https://github.com/MacXsimilian/kube-phoenix/commit/567fde6c29714dd5eb912f8a5b0656c688bfaeed))
* **frontend:** surface silent mutation/query failures across all components ([cf075b3](https://github.com/MacXsimilian/kube-phoenix/commit/cf075b37ff58725fd7e64ed3a8d31e0b11b10424))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([a252a53](https://github.com/MacXsimilian/kube-phoenix/commit/a252a53d765e22f75e09e4625855e9d5e88ded78))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* **helm:** sync chart version to 0.1.17 ([942d113](https://github.com/MacXsimilian/kube-phoenix/commit/942d11313fe7a50b2a48f94914d63fc3ea8f45e0))
* **history:** cast Box ref type to HTMLElement in LogViewer ([09cedcd](https://github.com/MacXsimilian/kube-phoenix/commit/09cedcdfe86e4576cf472c59ad80d05e6a3c14d5))
* **layout:** remove double margin-left pushing content off-center ([8e9af3f](https://github.com/MacXsimilian/kube-phoenix/commit/8e9af3f2306be0812ba0a28c7bdbe7cd969c629b))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([962ae8c](https://github.com/MacXsimilian/kube-phoenix/commit/962ae8c2f1fcba14129a34ed99b027a904276de1))
* migrate release-please to googleapis/release-please-action v4.4.0 ([42a2b79](https://github.com/MacXsimilian/kube-phoenix/commit/42a2b792c24bb4be972c6b186cbfa83115009f12))
* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([3b4c8b5](https://github.com/MacXsimilian/kube-phoenix/commit/3b4c8b511f99ae9e681c004e7c7c59ca2a8459ed))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([81cf0b3](https://github.com/MacXsimilian/kube-phoenix/commit/81cf0b3470f6c8828533bb9a56a450a9cc000552))
* **release:** run docker build and helm publish inside release-please workflow ([01f5001](https://github.com/MacXsimilian/kube-phoenix/commit/01f5001a40c04868180d8f1f2e9d47835930d153))
* remove npm cache — no package-lock.json in repo ([c945c26](https://github.com/MacXsimilian/kube-phoenix/commit/c945c26247ba9c68ce5696f09a17384ccbd66181))
* replace release-please action with npx CLI to avoid action policy restriction ([e7855a0](https://github.com/MacXsimilian/kube-phoenix/commit/e7855a0a1b03f0350827145949179ce1c1e44065))
* resolve all errcheck lint findings ([05743c8](https://github.com/MacXsimilian/kube-phoenix/commit/05743c87fd29e64578bf529bc7f205caca422f28))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([8743f78](https://github.com/MacXsimilian/kube-phoenix/commit/8743f7864b7d627b484fd9db5717946704705b72))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([c7dcf8f](https://github.com/MacXsimilian/kube-phoenix/commit/c7dcf8f9cfbed6b172e4a2353c0cd132b5b2f34a))
* **scaler:** align scale_down with original cronjob logic ([90c1ed7](https://github.com/MacXsimilian/kube-phoenix/commit/90c1ed7e124ba8ca8e37b471630a1f89763572e8))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))
* wrap ActivityFeed siblings in Fragment to resolve JSX syntax error ([74c1eb2](https://github.com/MacXsimilian/kube-phoenix/commit/74c1eb20855d50be76e1300338e670ffb992c962))

## [0.1.35](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.34...v0.1.35) (2026-03-14)


### Bug Fixes

* **ci:** run secret scan on push and PRs, not PRs only ([d83ed7c](https://github.com/MacXsimilian/kube-phoenix/commit/d83ed7ca7782ed3480978f47ff50ab5691fdcd80))

## [0.1.34](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.33...v0.1.34) (2026-03-14)


### Bug Fixes

* **ci:** bump Go to 1.25.8 to patch GO-2026-4601 and GO-2026-4602 ([60ec7a6](https://github.com/MacXsimilian/kube-phoenix/commit/60ec7a682ffba2d7d1e0c631441c1f979da5a853))

## [0.1.33](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.32...v0.1.33) (2026-03-14)


### Bug Fixes

* **ci:** exclude gosec G706 false positive for structured slog calls ([4d5c29a](https://github.com/MacXsimilian/kube-phoenix/commit/4d5c29a7b0ede72291d60bd21d3eb1e8af5efd5e))
* **ci:** restore go-version to 1.25 to match go.mod ([90f490f](https://github.com/MacXsimilian/kube-phoenix/commit/90f490fb990ef3bf21b1474bf8df48e46b182938))
* **ci:** revert to npm install until package-lock.json is committed ([4fab534](https://github.com/MacXsimilian/kube-phoenix/commit/4fab5342d2f99f2dae342be44a34d287f262042a))

fix: wrap ActivityFeed siblings in Fragment to resolve CI build failure

## [0.1.31](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.30...v0.1.31) (2026-03-14)


### Features

* custom auth UI, pod metrics, and cluster detail improvements ([be9092d](https://github.com/MacXsimilian/kube-phoenix/commit/be9092df93d04fbee6ba83654bfbf6410673540f))

## [0.1.30](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.29...v0.1.30) (2026-03-14)


### Bug Fixes

* **history:** cast Box ref type to HTMLElement in LogViewer ([09cedcd](https://github.com/MacXsimilian/kube-phoenix/commit/09cedcdfe86e4576cf472c59ad80d05e6a3c14d5))

## [0.1.29](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.28...v0.1.29) (2026-03-14)


### Features

* **frontend:** UI improvements, bug fixes, and cluster state enhancements ([8b95920](https://github.com/MacXsimilian/kube-phoenix/commit/8b95920b6bb22408b3af4db467fccadc7c84018e))


### Bug Fixes

* **cluster:** add React import for React.Fragment in NodeDetailDrawer ([dc62fba](https://github.com/MacXsimilian/kube-phoenix/commit/dc62fbac4682cd3344c80017b06935d6398ef12a))

## [0.1.28](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.27...v0.1.28) (2026-03-14)


### Features

* **cluster:** pod detail and workload detail drawers ([2021523](https://github.com/MacXsimilian/kube-phoenix/commit/2021523c7ab175c9a65e5faf6ec8932f1aacfe57))

## [0.1.27](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.26...v0.1.27) (2026-03-14)


### Features

* **cluster:** node pod drawer, workload kind labels, chart version sync ([13ea6e0](https://github.com/MacXsimilian/kube-phoenix/commit/13ea6e05a7483eec94843a74627a4b6c4a4644d5))
* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([92f4a24](https://github.com/MacXsimilian/kube-phoenix/commit/92f4a2426a684867acb22659d0053c6c7d584662))
* **frontend:** resizable log drawer with drag handle ([2c4fe22](https://github.com/MacXsimilian/kube-phoenix/commit/2c4fe22bd748ace44d4ffb7c0ae017c40148c778))
* **frontend:** responsive layout with collapsible sidebar ([e0f2e4a](https://github.com/MacXsimilian/kube-phoenix/commit/e0f2e4af82a15f660fcdbe99ecf8db04acdcfdb3))
* **frontend:** UX improvements and README overhaul ([af1490f](https://github.com/MacXsimilian/kube-phoenix/commit/af1490fbbcdb7fcb8762e9b7cde326d47419369f))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([f2a0c9d](https://github.com/MacXsimilian/kube-phoenix/commit/f2a0c9da965b05981c89e1deb00b0f158e3ec292))
* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([b2dc9b5](https://github.com/MacXsimilian/kube-phoenix/commit/b2dc9b56d249e9be0a83439b876a969a43e452ec))
* **overview:** next-run countdown, partial state, deep-link activity feed ([3c642a3](https://github.com/MacXsimilian/kube-phoenix/commit/3c642a39a6fa997f4f367a9d5de804800495cf4b))
* **settings:** add Reset Database with two-step confirmation ([fc9e0b7](https://github.com/MacXsimilian/kube-phoenix/commit/fc9e0b71bbbde4bda27c7388ec19965405d35615))
* **ui:** add phoenix emoji favicon ([43fa1db](https://github.com/MacXsimilian/kube-phoenix/commit/43fa1db55fb813ccbeddb5e698bd0108d856ea7b))
* **ui:** execution summary, db reset stream, and UX improvements ([bf87def](https://github.com/MacXsimilian/kube-phoenix/commit/bf87defdc979b20817eefa5106cd782ceaa649da))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([acb4f26](https://github.com/MacXsimilian/kube-phoenix/commit/acb4f269738cc0dabcab32feb13093e52090bcd0))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([7be22a3](https://github.com/MacXsimilian/kube-phoenix/commit/7be22a37fe01b9adab20fdd392a50a8c28a058df))
* check json.Encode error in createSchedule 201 response ([b072745](https://github.com/MacXsimilian/kube-phoenix/commit/b07274510338ac3eae25a7484d51b487795d7e2e))
* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([a0e3525](https://github.com/MacXsimilian/kube-phoenix/commit/a0e3525dee262b6eeb19b97635d14ef69881625a))
* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([30d2132](https://github.com/MacXsimilian/kube-phoenix/commit/30d21329799d5f54d0c0a50dc6d0654a1df03dad))
* **font:** self-host Inter via next/font — no runtime CDN requests ([b04fe6b](https://github.com/MacXsimilian/kube-phoenix/commit/b04fe6bd9cc1c9c3f8de21ecf83e33a2bb7e47d8))
* **frontend:** address UI audit findings ([82d1fa7](https://github.com/MacXsimilian/kube-phoenix/commit/82d1fa7aff11878f09811574a39ffb8a673de90d))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([567fde6](https://github.com/MacXsimilian/kube-phoenix/commit/567fde6c29714dd5eb912f8a5b0656c688bfaeed))
* **frontend:** surface silent mutation/query failures across all components ([cf075b3](https://github.com/MacXsimilian/kube-phoenix/commit/cf075b37ff58725fd7e64ed3a8d31e0b11b10424))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([a252a53](https://github.com/MacXsimilian/kube-phoenix/commit/a252a53d765e22f75e09e4625855e9d5e88ded78))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* **helm:** sync chart version to 0.1.17 ([942d113](https://github.com/MacXsimilian/kube-phoenix/commit/942d11313fe7a50b2a48f94914d63fc3ea8f45e0))
* **layout:** remove double margin-left pushing content off-center ([8e9af3f](https://github.com/MacXsimilian/kube-phoenix/commit/8e9af3f2306be0812ba0a28c7bdbe7cd969c629b))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([962ae8c](https://github.com/MacXsimilian/kube-phoenix/commit/962ae8c2f1fcba14129a34ed99b027a904276de1))
* migrate release-please to googleapis/release-please-action v4.4.0 ([42a2b79](https://github.com/MacXsimilian/kube-phoenix/commit/42a2b792c24bb4be972c6b186cbfa83115009f12))
* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([3b4c8b5](https://github.com/MacXsimilian/kube-phoenix/commit/3b4c8b511f99ae9e681c004e7c7c59ca2a8459ed))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([81cf0b3](https://github.com/MacXsimilian/kube-phoenix/commit/81cf0b3470f6c8828533bb9a56a450a9cc000552))
* **release:** run docker build and helm publish inside release-please workflow ([01f5001](https://github.com/MacXsimilian/kube-phoenix/commit/01f5001a40c04868180d8f1f2e9d47835930d153))
* remove npm cache — no package-lock.json in repo ([c945c26](https://github.com/MacXsimilian/kube-phoenix/commit/c945c26247ba9c68ce5696f09a17384ccbd66181))
* replace release-please action with npx CLI to avoid action policy restriction ([e7855a0](https://github.com/MacXsimilian/kube-phoenix/commit/e7855a0a1b03f0350827145949179ce1c1e44065))
* resolve all errcheck lint findings ([05743c8](https://github.com/MacXsimilian/kube-phoenix/commit/05743c87fd29e64578bf529bc7f205caca422f28))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([8743f78](https://github.com/MacXsimilian/kube-phoenix/commit/8743f7864b7d627b484fd9db5717946704705b72))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([c7dcf8f](https://github.com/MacXsimilian/kube-phoenix/commit/c7dcf8f9cfbed6b172e4a2353c0cd132b5b2f34a))
* **scaler:** align scale_down with original cronjob logic ([90c1ed7](https://github.com/MacXsimilian/kube-phoenix/commit/90c1ed7e124ba8ca8e37b471630a1f89763572e8))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))
