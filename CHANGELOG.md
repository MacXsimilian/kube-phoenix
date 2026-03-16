# Changelog

## [0.1.60](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.59...v0.1.60) (2026-03-16)


### Features

* serve Swagger UI at /api/docs/ ([534022a](https://github.com/MacXsimilian/kube-phoenix/commit/534022a5b7be88c9fcef86b4fee562079a757bcb))


### Bug Fixes

* address senior engineer audit of swagger UI ([bda295b](https://github.com/MacXsimilian/kube-phoenix/commit/bda295b28c91dcf3329b216d499882ffed2265dd))
* address swagger UI audit issues ([b4652af](https://github.com/MacXsimilian/kube-phoenix/commit/b4652afdc15a2723bb5383061ce1943111200020))

## [0.1.59](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.58...v0.1.59) (2026-03-15)


### Bug Fixes

* **metrics:** log HTTP status code on metrics API failure ([90f840e](https://github.com/MacXsimilian/kube-phoenix/commit/90f840e0853289ff0ad5766603d6e3d9bf6c8ffa))
* **metrics:** log HTTP status code on metrics API failure ([df29f63](https://github.com/MacXsimilian/kube-phoenix/commit/df29f63880d18fda8720839a27ff1eaaa0db4b06))

## [0.1.58](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.57...v0.1.58) (2026-03-15)


### Bug Fixes

* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([f3914d4](https://github.com/MacXsimilian/kube-phoenix/commit/f3914d4978aba4a33d387527d9f5e7fc3d61ad8d))
* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([01941b0](https://github.com/MacXsimilian/kube-phoenix/commit/01941b05718a7b6f6fc585b09e285c5004213df8))

## [0.1.57](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.56...v0.1.57) (2026-03-15)


### Features

* **cluster:** show actual CPU/mem usage in node and workload pod lists ([8c661d4](https://github.com/MacXsimilian/kube-phoenix/commit/8c661d4491d629be65e17cb16e865369f09a54df))
* **cluster:** show actual CPU/mem usage in node and workload pod lists ([adcf8cb](https://github.com/MacXsimilian/kube-phoenix/commit/adcf8cbd7191253bea7f20a382a133369d8e7f03))

## [0.1.56](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.55...v0.1.56) (2026-03-15)


### Bug Fixes

* **ui:** rework light mode — fix all hardcoded dark colors ([f38ba65](https://github.com/MacXsimilian/kube-phoenix/commit/f38ba65b0fa262e826e809f5ea6c614a323d6ee4))

## [0.1.55](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.54...v0.1.55) (2026-03-15)


### Features

* **schedules:** drag-and-drop reordering persisted per schedule type ([b41f643](https://github.com/MacXsimilian/kube-phoenix/commit/b41f643490699acb6475c4f6b463168cfb291795))
* **schedules:** drag-and-drop reordering persisted per schedule type ([8bd612c](https://github.com/MacXsimilian/kube-phoenix/commit/8bd612c72045f0859ee1db17b38978c5e7a568b4))


### Bug Fixes

* **overview:** equal-height cards + update docs for reorder and position field ([006d221](https://github.com/MacXsimilian/kube-phoenix/commit/006d221224e448f58559928dbee9a731bb278b58))
* **schedules:** move dnd modifiers to correct package ([6a283eb](https://github.com/MacXsimilian/kube-phoenix/commit/6a283eb8287c479181315044be73c6d24014b194))

## [0.1.54](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.53...v0.1.54) (2026-03-15)


### Bug Fixes

* **security:** redact WS token from logs, fix RBAC replicasets, add reset-db audit log ([2409917](https://github.com/MacXsimilian/kube-phoenix/commit/240991749e8cfb3e31e2d10ae626d3c819775c28))
* **security:** redact WS token from logs, fix RBAC, add reset-db audit log ([40e9b7a](https://github.com/MacXsimilian/kube-phoenix/commit/40e9b7ae8882040b09270155102d6c3f16b61bb4))

## [0.1.53](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.52...v0.1.53) (2026-03-15)


### Bug Fixes

* input validation, error sanitisation, and CORS hardening ([e3e4ad7](https://github.com/MacXsimilian/kube-phoenix/commit/e3e4ad76dc316e265caee478df6d6692175da64f))
* input validation, error sanitisation, and CORS hardening ([4d7b578](https://github.com/MacXsimilian/kube-phoenix/commit/4d7b5788213fac002e5c8724ffd21e7f4561d103))

## [0.1.52](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.51...v0.1.52) (2026-03-15)


### Bug Fixes

* cache invalidation gaps, error handling, and UX improvements ([e118ddc](https://github.com/MacXsimilian/kube-phoenix/commit/e118ddcbd6372eb2f946ebca9248e563a9dc3fb3))
* cache invalidation gaps, error handling, and UX improvements ([55cce0d](https://github.com/MacXsimilian/kube-phoenix/commit/55cce0da8a558a55908d53b74ad6352f80adc5b1))

## [0.1.51](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.50...v0.1.51) (2026-03-15)


### Bug Fixes

* address audit findings — logging, WS goroutine leak, scaler drain safety, count persistence ([8816975](https://github.com/MacXsimilian/kube-phoenix/commit/88169751119ea127ab8414a5e758bfbbdb2c5ee1))
* audit findings — logging, WS goroutine safety, drain reliability, count persistence ([b09887c](https://github.com/MacXsimilian/kube-phoenix/commit/b09887c687afce6d8bd1f3920d31275616453400))

## [0.1.50](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.49...v0.1.50) (2026-03-15)


### Bug Fixes

* **formatters:** timeUntil now formats days for countdowns over 24 h ([5d309a2](https://github.com/MacXsimilian/kube-phoenix/commit/5d309a2b13007ac552aed746242f841b7d099010))

## [0.1.49](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.48...v0.1.49) (2026-03-15)


### Features

* add light/dark/system theme mode switcher ([bbf520e](https://github.com/MacXsimilian/kube-phoenix/commit/bbf520e83f38043b75e4a1fa98c35baf04a64044))
* light/dark/system theme mode switcher ([579cf0d](https://github.com/MacXsimilian/kube-phoenix/commit/579cf0d0851799cc965bb5cbd24e4410dbc99ab8))

## [0.1.48](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.47...v0.1.48) (2026-03-15)


### Bug Fixes

* **formatters:** timeUntil now formats days for countdowns over 24 h ([d3fa6a7](https://github.com/MacXsimilian/kube-phoenix/commit/d3fa6a77a06fc40e4351837173dec2a5e9ab0528))
* timeUntil shows days for countdowns over 24h ([9d92854](https://github.com/MacXsimilian/kube-phoenix/commit/9d928540bc319411712663231db5e2d776872a80))

## [0.1.47](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.46...v0.1.47) (2026-03-15)


### Features

* **schedules:** add inline toggle feedback — spinner, Saved label, F… ([c131b16](https://github.com/MacXsimilian/kube-phoenix/commit/c131b1635d80c554f5f5b646a9b4a43237ee47ea))
* **schedules:** add inline toggle feedback — spinner, Saved label, Failed state ([578ef88](https://github.com/MacXsimilian/kube-phoenix/commit/578ef8837282b869ccc7b8fdf69c2f09d418459e))

## [0.1.46](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.45...v0.1.46) (2026-03-15)


### Features

* add About modal triggered from kube-phoenix title ([fd24da4](https://github.com/MacXsimilian/kube-phoenix/commit/fd24da4cc74c29739a26ddf1f67169b00f10b2f2))
* add system-protected namespaces with deletion confirmation ([e15d6e5](https://github.com/MacXsimilian/kube-phoenix/commit/e15d6e52204b4c665bd033bb29ac16cd738d28d9))
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
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([ea68d60](https://github.com/MacXsimilian/kube-phoenix/commit/ea68d60eb3972a55bd62dca031af575df36c6648))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([567fde6](https://github.com/MacXsimilian/kube-phoenix/commit/567fde6c29714dd5eb912f8a5b0656c688bfaeed))
* **frontend:** surface silent mutation/query failures across all components ([cf075b3](https://github.com/MacXsimilian/kube-phoenix/commit/cf075b37ff58725fd7e64ed3a8d31e0b11b10424))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([a252a53](https://github.com/MacXsimilian/kube-phoenix/commit/a252a53d765e22f75e09e4625855e9d5e88ded78))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* **helm:** sync chart version to 0.1.17 ([942d113](https://github.com/MacXsimilian/kube-phoenix/commit/942d11313fe7a50b2a48f94914d63fc3ea8f45e0))
* history UX corrections and browser native auth popup ([15378a9](https://github.com/MacXsimilian/kube-phoenix/commit/15378a9ce931601ea238b24643d73b28b022a6a5))
* history UX corrections and browser native auth popup ([d51942c](https://github.com/MacXsimilian/kube-phoenix/commit/d51942c51496bb44f00db5049850076fbf6f3ee0))
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
* schedule toggle persistence, next-run UX, double-v version ([282c921](https://github.com/MacXsimilian/kube-phoenix/commit/282c921e3df5ddf410f9af515a7986369ef3433e))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([86b3a82](https://github.com/MacXsimilian/kube-phoenix/commit/86b3a82e95524644e9c0ffdb5d3918948a8abd84))
* **schedules:** resolve stale closure causing toggle not to persist ([1171b6a](https://github.com/MacXsimilian/kube-phoenix/commit/1171b6aa5458c0ab9e14081c6e45e8f0fd1297fc))
* **schedules:** resolve stale closure causing toggle not to persist ([66ec7c5](https://github.com/MacXsimilian/kube-phoenix/commit/66ec7c5d97694f015fc69138c34cf15645428b05))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))
* wrap ActivityFeed siblings in Fragment to resolve JSX syntax error ([74c1eb2](https://github.com/MacXsimilian/kube-phoenix/commit/74c1eb20855d50be76e1300338e670ffb992c962))


### Performance Improvements

* **overview:** cluster cache, SSE stream, and overview endpoint ([9536a91](https://github.com/MacXsimilian/kube-phoenix/commit/9536a91630318533628925fb0ed9166b2b0bb27b))
* **overview:** cluster cache, SSE stream, and overview endpoint ([93421ef](https://github.com/MacXsimilian/kube-phoenix/commit/93421ef34b09b3bfb0fbda8180a7378f057ebb60))

## [0.1.45](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.44...v0.1.45) (2026-03-15)


### Bug Fixes

* **schedules:** resolve stale closure causing toggle not to persist ([1171b6a](https://github.com/MacXsimilian/kube-phoenix/commit/1171b6aa5458c0ab9e14081c6e45e8f0fd1297fc))
* **schedules:** resolve stale closure causing toggle not to persist ([66ec7c5](https://github.com/MacXsimilian/kube-phoenix/commit/66ec7c5d97694f015fc69138c34cf15645428b05))

## [0.1.44](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.43...v0.1.44) (2026-03-15)


### Bug Fixes

* schedule toggle persistence, next-run UX, double-v version ([282c921](https://github.com/MacXsimilian/kube-phoenix/commit/282c921e3df5ddf410f9af515a7986369ef3433e))
* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([86b3a82](https://github.com/MacXsimilian/kube-phoenix/commit/86b3a82e95524644e9c0ffdb5d3918948a8abd84))

## [0.1.43](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.42...v0.1.43) (2026-03-15)


### Bug Fixes

* **backend:** check fmt.Fprintf error in SSE handler ([ba0cc1c](https://github.com/MacXsimilian/kube-phoenix/commit/ba0cc1c9814eb3c7b9e86c799a0b0c673ee79b2a))


### Performance Improvements

* **overview:** cluster cache, SSE stream, and overview endpoint ([9536a91](https://github.com/MacXsimilian/kube-phoenix/commit/9536a91630318533628925fb0ed9166b2b0bb27b))
* **overview:** cluster cache, SSE stream, and overview endpoint ([93421ef](https://github.com/MacXsimilian/kube-phoenix/commit/93421ef34b09b3bfb0fbda8180a7378f057ebb60))

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
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([ea68d60](https://github.com/MacXsimilian/kube-phoenix/commit/ea68d60eb3972a55bd62dca031af575df36c6648))

## [0.1.39](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.38...v0.1.39) (2026-03-15)


### Bug Fixes

* history UX corrections and browser native auth popup ([15378a9](https://github.com/MacXsimilian/kube-phoenix/commit/15378a9ce931601ea238b24643d73b28b022a6a5))
* history UX corrections and browser native auth popup ([d51942c](https://github.com/MacXsimilian/kube-phoenix/commit/d51942c51496bb44f00db5049850076fbf6f3ee0))

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

## [0.1.34](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.33...v0.1.34) (2026-03-14)


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

## [0.1.33](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.32...v0.1.33) (2026-03-14)


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

## [0.1.32](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.31...v0.1.32) (2026-03-14)


### Features

* branded login screen, nav reorder, inline log drawer, and docs ([9e92e30](https://github.com/MacXsimilian/kube-phoenix/commit/9e92e304d88f2737c0ef5a99452b58290906928d))

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

## [0.1.26](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.25...v0.1.26) (2026-03-14)


### Features

* **ui:** execution summary, db reset stream, and UX improvements ([bf87def](https://github.com/MacXsimilian/kube-phoenix/commit/bf87defdc979b20817eefa5106cd782ceaa649da))

## [0.1.25](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.24...v0.1.25) (2026-03-14)


### Features

* **ui:** add phoenix emoji favicon ([43fa1db](https://github.com/MacXsimilian/kube-phoenix/commit/43fa1db55fb813ccbeddb5e698bd0108d856ea7b))


### Bug Fixes

* **font:** self-host Inter via next/font — no runtime CDN requests ([b04fe6b](https://github.com/MacXsimilian/kube-phoenix/commit/b04fe6bd9cc1c9c3f8de21ecf83e33a2bb7e47d8))
* **layout:** remove double margin-left pushing content off-center ([8e9af3f](https://github.com/MacXsimilian/kube-phoenix/commit/8e9af3f2306be0812ba0a28c7bdbe7cd969c629b))

## [0.1.24](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.23...v0.1.24) (2026-03-14)


### Bug Fixes

* **frontend:** surface silent mutation/query failures across all components ([cf075b3](https://github.com/MacXsimilian/kube-phoenix/commit/cf075b37ff58725fd7e64ed3a8d31e0b11b10424))

## [0.1.23](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.22...v0.1.23) (2026-03-14)


### Features

* **settings:** add Reset Database with two-step confirmation ([fc9e0b7](https://github.com/MacXsimilian/kube-phoenix/commit/fc9e0b71bbbde4bda27c7388ec19965405d35615))


### Bug Fixes

* **scaler:** align scale_down with original cronjob logic ([90c1ed7](https://github.com/MacXsimilian/kube-phoenix/commit/90c1ed7e124ba8ca8e37b471630a1f89763572e8))

## [0.1.22](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.21...v0.1.22) (2026-03-13)


### Bug Fixes

* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([567fde6](https://github.com/MacXsimilian/kube-phoenix/commit/567fde6c29714dd5eb912f8a5b0656c688bfaeed))

## [0.1.21](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.20...v0.1.21) (2026-03-13)


### Features

* **frontend:** responsive layout with collapsible sidebar ([e0f2e4a](https://github.com/MacXsimilian/kube-phoenix/commit/e0f2e4af82a15f660fcdbe99ecf8db04acdcfdb3))


### Bug Fixes

* **frontend:** address UI audit findings ([82d1fa7](https://github.com/MacXsimilian/kube-phoenix/commit/82d1fa7aff11878f09811574a39ffb8a673de90d))

## [0.1.20](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.19...v0.1.20) (2026-03-13)


### Features

* **cluster:** node pod drawer, workload kind labels, chart version sync ([13ea6e0](https://github.com/MacXsimilian/kube-phoenix/commit/13ea6e05a7483eec94843a74627a4b6c4a4644d5))

## [0.1.19](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.18...v0.1.19) (2026-03-13)


### Bug Fixes

* **helm:** sync chart version to 0.1.17 ([942d113](https://github.com/MacXsimilian/kube-phoenix/commit/942d11313fe7a50b2a48f94914d63fc3ea8f45e0))

## [0.1.18](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.17...v0.1.18) (2026-03-13)


### Features

* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([92f4a24](https://github.com/MacXsimilian/kube-phoenix/commit/92f4a2426a684867acb22659d0053c6c7d584662))
* **frontend:** resizable log drawer with drag handle ([2c4fe22](https://github.com/MacXsimilian/kube-phoenix/commit/2c4fe22bd748ace44d4ffb7c0ae017c40148c778))

## [0.1.17](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.16...v0.1.17) (2026-03-13)


### Bug Fixes

* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([a252a53](https://github.com/MacXsimilian/kube-phoenix/commit/a252a53d765e22f75e09e4625855e9d5e88ded78))

## [0.1.16](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.15...v0.1.16) (2026-03-13)


### Features

* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([b2dc9b5](https://github.com/MacXsimilian/kube-phoenix/commit/b2dc9b56d249e9be0a83439b876a969a43e452ec))

## [0.1.15](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.14...v0.1.15) (2026-03-13)


### Bug Fixes

* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([3b4c8b5](https://github.com/MacXsimilian/kube-phoenix/commit/3b4c8b511f99ae9e681c004e7c7c59ca2a8459ed))

## [0.1.14](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.13...v0.1.14) (2026-03-13)


### Bug Fixes

* **release:** run docker build and helm publish inside release-please workflow ([01f5001](https://github.com/MacXsimilian/kube-phoenix/commit/01f5001a40c04868180d8f1f2e9d47835930d153))

## [0.1.13](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.12...v0.1.13) (2026-03-13)


### Bug Fixes

* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([a0e3525](https://github.com/MacXsimilian/kube-phoenix/commit/a0e3525dee262b6eeb19b97635d14ef69881625a))

## [0.1.12](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.11...v0.1.12) (2026-03-13)


### Bug Fixes

* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([81cf0b3](https://github.com/MacXsimilian/kube-phoenix/commit/81cf0b3470f6c8828533bb9a56a450a9cc000552))

## [0.1.11](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.10...v0.1.11) (2026-03-13)


### Bug Fixes

* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([30d2132](https://github.com/MacXsimilian/kube-phoenix/commit/30d21329799d5f54d0c0a50dc6d0654a1df03dad))

## [0.1.10](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.9...v0.1.10) (2026-03-13)


### Features

* **frontend:** UX improvements and README overhaul ([af1490f](https://github.com/MacXsimilian/kube-phoenix/commit/af1490fbbcdb7fcb8762e9b7cde326d47419369f))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([f2a0c9d](https://github.com/MacXsimilian/kube-phoenix/commit/f2a0c9da965b05981c89e1deb00b0f158e3ec292))
* **overview:** next-run countdown, partial state, deep-link activity feed ([3c642a3](https://github.com/MacXsimilian/kube-phoenix/commit/3c642a39a6fa997f4f367a9d5de804800495cf4b))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([acb4f26](https://github.com/MacXsimilian/kube-phoenix/commit/acb4f269738cc0dabcab32feb13093e52090bcd0))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([7be22a3](https://github.com/MacXsimilian/kube-phoenix/commit/7be22a37fe01b9adab20fdd392a50a8c28a058df))
* check json.Encode error in createSchedule 201 response ([b072745](https://github.com/MacXsimilian/kube-phoenix/commit/b07274510338ac3eae25a7484d51b487795d7e2e))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([962ae8c](https://github.com/MacXsimilian/kube-phoenix/commit/962ae8c2f1fcba14129a34ed99b027a904276de1))
* migrate release-please to googleapis/release-please-action v4.4.0 ([42a2b79](https://github.com/MacXsimilian/kube-phoenix/commit/42a2b792c24bb4be972c6b186cbfa83115009f12))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* remove npm cache — no package-lock.json in repo ([c945c26](https://github.com/MacXsimilian/kube-phoenix/commit/c945c26247ba9c68ce5696f09a17384ccbd66181))
* replace release-please action with npx CLI to avoid action policy restriction ([e7855a0](https://github.com/MacXsimilian/kube-phoenix/commit/e7855a0a1b03f0350827145949179ce1c1e44065))
* resolve all errcheck lint findings ([05743c8](https://github.com/MacXsimilian/kube-phoenix/commit/05743c87fd29e64578bf529bc7f205caca422f28))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([8743f78](https://github.com/MacXsimilian/kube-phoenix/commit/8743f7864b7d627b484fd9db5717946704705b72))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([c7dcf8f](https://github.com/MacXsimilian/kube-phoenix/commit/c7dcf8f9cfbed6b172e4a2353c0cd132b5b2f34a))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))

## [0.1.9](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.8...v0.1.9) (2026-03-13)


### Features

* **frontend:** UX improvements and README overhaul ([af1490f](https://github.com/MacXsimilian/kube-phoenix/commit/af1490fbbcdb7fcb8762e9b7cde326d47419369f))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([f2a0c9d](https://github.com/MacXsimilian/kube-phoenix/commit/f2a0c9da965b05981c89e1deb00b0f158e3ec292))
* **overview:** next-run countdown, partial state, deep-link activity feed ([3c642a3](https://github.com/MacXsimilian/kube-phoenix/commit/3c642a39a6fa997f4f367a9d5de804800495cf4b))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([acb4f26](https://github.com/MacXsimilian/kube-phoenix/commit/acb4f269738cc0dabcab32feb13093e52090bcd0))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* check json.Encode error in createSchedule 201 response ([b072745](https://github.com/MacXsimilian/kube-phoenix/commit/b07274510338ac3eae25a7484d51b487795d7e2e))
* grant packages: write at workflow level for reusable docker workflow ([2943f96](https://github.com/MacXsimilian/kube-phoenix/commit/2943f969c79cf6c4d1b3a416605a64a196045b8f))
* **helm:** address chart audit findings ([982f9be](https://github.com/MacXsimilian/kube-phoenix/commit/982f9be548c85d846f3d8fd193978fcd0d4deda1))
* **helm:** stamp chart version and appVersion from git tag at release time ([6d0993b](https://github.com/MacXsimilian/kube-phoenix/commit/6d0993b904e5a56556e6027c232c02889750afaf))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([962ae8c](https://github.com/MacXsimilian/kube-phoenix/commit/962ae8c2f1fcba14129a34ed99b027a904276de1))
* migrate release-please to googleapis/release-please-action v4.4.0 ([42a2b79](https://github.com/MacXsimilian/kube-phoenix/commit/42a2b792c24bb4be972c6b186cbfa83115009f12))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* remove npm cache — no package-lock.json in repo ([c945c26](https://github.com/MacXsimilian/kube-phoenix/commit/c945c26247ba9c68ce5696f09a17384ccbd66181))
* replace release-please action with npx CLI to avoid action policy restriction ([e7855a0](https://github.com/MacXsimilian/kube-phoenix/commit/e7855a0a1b03f0350827145949179ce1c1e44065))
* resolve all errcheck lint findings ([05743c8](https://github.com/MacXsimilian/kube-phoenix/commit/05743c87fd29e64578bf529bc7f205caca422f28))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([8743f78](https://github.com/MacXsimilian/kube-phoenix/commit/8743f7864b7d627b484fd9db5717946704705b72))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([c7dcf8f](https://github.com/MacXsimilian/kube-phoenix/commit/c7dcf8f9cfbed6b172e4a2353c0cd132b5b2f34a))
* **scheduler:** detach manual trigger from HTTP request context ([15b9933](https://github.com/MacXsimilian/kube-phoenix/commit/15b9933b8a6eaee48a26721ad12b18e1f436c101))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([907114c](https://github.com/MacXsimilian/kube-phoenix/commit/907114cb1d4d96ee9f71ad182943a519c6454a08))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3aae3e1](https://github.com/MacXsimilian/kube-phoenix/commit/3aae3e14c54d9e5bafcfb005e9b9ac4ddbbbbc3c))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))

## [0.1.8](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.7...v0.1.8) (2026-03-12)


### Features

* **helm:** add TargetGroupBinding support for EKS ALB integration ([2c591bd](https://github.com/MacXsimilian/kube-phoenix/commit/2c591bd7c9487d9945052de177231aa0986333c7))
* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.7](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.6...v0.1.7) (2026-03-12)


### Features

* **helm:** add TargetGroupBinding support for EKS ALB integration ([2c591bd](https://github.com/MacXsimilian/kube-phoenix/commit/2c591bd7c9487d9945052de177231aa0986333c7))
* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.6](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.5...v0.1.6) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))

## [0.1.5](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.4...v0.1.5) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.4](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.3...v0.1.4) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))

## [0.1.3](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.2...v0.1.3) (2026-03-12)


### Features

* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))

## [0.1.2](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.1...v0.1.2) (2026-03-12)


### Bug Fixes

* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))

## [0.1.1](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.0...v0.1.1) (2026-03-12)


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))
