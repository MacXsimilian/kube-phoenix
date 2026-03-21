# Changelog

## [0.1.78](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.77...v0.1.78) (2026-03-21)


### Features

* add About modal triggered from kube-phoenix title ([1770312](https://github.com/MacXsimilian/kube-phoenix/commit/17703127c37a50e0bce9b6a777b6cf5fba91ce77))
* add light/dark/system theme mode switcher ([cf19148](https://github.com/MacXsimilian/kube-phoenix/commit/cf191483fd7c5bd6d6aa19cb99b5eb7141419a9c))
* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([f6d2878](https://github.com/MacXsimilian/kube-phoenix/commit/f6d28782c1f4dde5d8d56666880e44fa1ed8cad9))
* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([d285d79](https://github.com/MacXsimilian/kube-phoenix/commit/d285d79f17826a07c5decfec733ae2305203963e))
* add preventive RBAC UI guards on all mutation buttons ([270d248](https://github.com/MacXsimilian/kube-phoenix/commit/270d248515c2abb2840bcde3659e877a934ed890))
* add Prometheus metrics endpoint at /metrics ([9c1725b](https://github.com/MacXsimilian/kube-phoenix/commit/9c1725b3fe468b729dc696665311bb9231c9acf4))
* add Prometheus metrics endpoint at /metrics ([d7bf022](https://github.com/MacXsimilian/kube-phoenix/commit/d7bf022cb59cf3d67f7b8b3aac2427873dbbaaa0))
* add streaming pod log viewer to cluster drawer ([4e42556](https://github.com/MacXsimilian/kube-phoenix/commit/4e42556fe8fac058d6e4b5acfd980328cf8c89af))
* add streaming pod log viewer to cluster drawer ([c772c38](https://github.com/MacXsimilian/kube-phoenix/commit/c772c38a14cd465d3cafcbaf9ac005a023a6890a))
* add streaming pod log viewer to pod detail ([b3c4407](https://github.com/MacXsimilian/kube-phoenix/commit/b3c4407cc883f0af3469e465774d33a54faca5b9))
* add system-protected namespaces with deletion confirmation ([b0ab6b1](https://github.com/MacXsimilian/kube-phoenix/commit/b0ab6b19c7fb37e5df32fdd3b12ae0c54cd9f8e7))
* branded login screen, nav reorder, inline log drawer, and docs ([ef79fdd](https://github.com/MacXsimilian/kube-phoenix/commit/ef79fdd98bf2abc3b372a2ad01591706f4524d95))
* **build:** add BuildKit cache mounts and Docker CI validation ([8239829](https://github.com/MacXsimilian/kube-phoenix/commit/8239829583c72c4725f3ebc4bbcd4966d58458bb))
* **build:** add BuildKit cache mounts and Docker CI validation ([96d43f0](https://github.com/MacXsimilian/kube-phoenix/commit/96d43f04bff3e1e7696f810a06c8fe66f371629f))
* **cluster:** add streaming pod log viewer to pod detail ([e974aa3](https://github.com/MacXsimilian/kube-phoenix/commit/e974aa378d81cef5e62df1df1de1cbe1756fdbee))
* **cluster:** node pod drawer, workload kind labels, chart version sync ([20d7346](https://github.com/MacXsimilian/kube-phoenix/commit/20d73464c56918849783a242f5952577752d746e))
* **cluster:** pod detail and workload detail drawers ([3e02075](https://github.com/MacXsimilian/kube-phoenix/commit/3e020752f353ffd9c44da469c41f21b66fc4da31))
* **cluster:** show actual CPU/mem usage in node and workload pod lists ([1aed72c](https://github.com/MacXsimilian/kube-phoenix/commit/1aed72cda3cb64182e909ffaec8ebb7d6685e603))
* **cluster:** show actual CPU/mem usage in node and workload pod lists ([982733d](https://github.com/MacXsimilian/kube-phoenix/commit/982733ddeaf33ab13264464df00570c02844cfc3))
* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([d0f99be](https://github.com/MacXsimilian/kube-phoenix/commit/d0f99be1dc2edf0cea6c9cf9010d6aba6e9255c8))
* custom auth UI, pod metrics, and cluster detail improvements ([433d1e0](https://github.com/MacXsimilian/kube-phoenix/commit/433d1e05c5e344177c904bfd3de204fdd5713ed0))
* **db:** upgrade PostgreSQL from 16 to 17.7 ([4e827a8](https://github.com/MacXsimilian/kube-phoenix/commit/4e827a8d49091a2416653c4c30e65ed520bca36a))
* **db:** upgrade PostgreSQL from 16 to 17.7 ([16527ab](https://github.com/MacXsimilian/kube-phoenix/commit/16527ab258e2c52cf499fd1555240f15f1de1eab))
* **frontend:** resizable log drawer with drag handle ([9ac6869](https://github.com/MacXsimilian/kube-phoenix/commit/9ac6869053c755d88080b4b6d33a25920d950a37))
* **frontend:** responsive layout with collapsible sidebar ([b9b2b69](https://github.com/MacXsimilian/kube-phoenix/commit/b9b2b69cb4a787401650f4c13c768ea7677f395c))
* **frontend:** UI improvements, bug fixes, and cluster state enhancements ([1180bdd](https://github.com/MacXsimilian/kube-phoenix/commit/1180bddceb0c42afa9bd942528ab91b6b8199552))
* **frontend:** UX improvements and README overhaul ([76631e4](https://github.com/MacXsimilian/kube-phoenix/commit/76631e477f93cc40b4f0a346226d50cd2682f071))
* **guardrails:** system-protected namespaces with deletion confirmation ([c558b2c](https://github.com/MacXsimilian/kube-phoenix/commit/c558b2cc9695302debcfff803bcc9cae8457fecf))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([0c62496](https://github.com/MacXsimilian/kube-phoenix/commit/0c6249672209fc7e873cb005a5041a711f9feb3b))
* **helm:** harden chart with missing production features ([57aa120](https://github.com/MacXsimilian/kube-phoenix/commit/57aa120f31b96b4202e25bf1837b6368969a859d))
* **helm:** harden chart with missing production features ([67970c6](https://github.com/MacXsimilian/kube-phoenix/commit/67970c6f2890889528333a2e3078b088d5ee0b21))
* light/dark/system theme mode switcher ([4ee8824](https://github.com/MacXsimilian/kube-phoenix/commit/4ee882438c68266202ca5ffbaee49790b8b94f8b))
* **oidc:** add TLS skip verify and custom CA cert support ([a39ce1a](https://github.com/MacXsimilian/kube-phoenix/commit/a39ce1ab7591f3101d474fe6a43aaae846c094a6))
* **oidc:** add TLS skip verify and custom CA cert support ([23097a7](https://github.com/MacXsimilian/kube-phoenix/commit/23097a72628f04802ae40b017f31fdd292890433))
* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([4f71de3](https://github.com/MacXsimilian/kube-phoenix/commit/4f71de38fa901bb682dc79a51bb6491d68c0b0db))
* **overview:** next-run countdown, partial state, deep-link activity feed ([714fc50](https://github.com/MacXsimilian/kube-phoenix/commit/714fc50a22b4333804a40bbd7d59555e756ccbff))
* **overview:** remove Schedules card, fix activity feed UX, add README badges ([b248fa6](https://github.com/MacXsimilian/kube-phoenix/commit/b248fa63217436f4284b577b29941342da61ea54))
* replace cron text field with visual CronBuilder in schedule dialog ([3185e1f](https://github.com/MacXsimilian/kube-phoenix/commit/3185e1f5bf194453bc3ff51694b0d1f83a6c7de8))
* replace cron text field with visual CronBuilder in schedule dialog ([43e34f5](https://github.com/MacXsimilian/kube-phoenix/commit/43e34f5197f1e904f65832808dbeaee2e10d6882))
* **schedules:** add inline toggle feedback — spinner, Saved label, F… ([41e88ae](https://github.com/MacXsimilian/kube-phoenix/commit/41e88ae90caa71cf6ddca1bdb902c407c5f8bfea))
* **schedules:** add inline toggle feedback — spinner, Saved label, Failed state ([41c6ace](https://github.com/MacXsimilian/kube-phoenix/commit/41c6ace78f832d9fe2a6129460dce0b6986fe417))
* **schedules:** drag-and-drop reordering persisted per schedule type ([f5abf84](https://github.com/MacXsimilian/kube-phoenix/commit/f5abf848997b8f37f3e050c93ffd17c76033c8ee))
* **schedules:** drag-and-drop reordering persisted per schedule type ([9795500](https://github.com/MacXsimilian/kube-phoenix/commit/97955006c361d74bb3d0e8ce35eec0d7c253cab2))
* serve Swagger UI at /api/docs/ ([4966b24](https://github.com/MacXsimilian/kube-phoenix/commit/4966b24621bc7ac2725949014665c432e4d82b5d))
* **settings:** add OIDC config status checker ([1e038af](https://github.com/MacXsimilian/kube-phoenix/commit/1e038af460f3b62949a63861c46a755dba554235))
* **settings:** add Reset Database with two-step confirmation ([7001d70](https://github.com/MacXsimilian/kube-phoenix/commit/7001d702fbad4adb44c78b73e1ceac202ddaba13))
* **settings:** OIDC config status checker ([86ba7f0](https://github.com/MacXsimilian/kube-phoenix/commit/86ba7f0a4d9cd67a68a28653957ca8883732e385))
* **ui:** add phoenix emoji favicon ([b0da1ff](https://github.com/MacXsimilian/kube-phoenix/commit/b0da1ff359cc00fc679d0c38284ea3d0481f60ed))
* **ui:** execution summary, db reset stream, and UX improvements ([4003034](https://github.com/MacXsimilian/kube-phoenix/commit/4003034ab9a32c486f3fee81a24502501300ad7f))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([1118354](https://github.com/MacXsimilian/kube-phoenix/commit/1118354feab753295bccd847cd4119de2a2448d0))


### Bug Fixes

* add WWW-Authenticate header so browsers prompt for credentials ([247330e](https://github.com/MacXsimilian/kube-phoenix/commit/247330e41f925ff3b4ee16ebf8342eceb53428ea))
* add WWW-Authenticate header so browsers prompt for credentials ([4e89065](https://github.com/MacXsimilian/kube-phoenix/commit/4e890656d952b6dd377d29245ef62841adeaabf7))
* address audit findings — logging, WS goroutine leak, scaler drain safety, count persistence ([cf70952](https://github.com/MacXsimilian/kube-phoenix/commit/cf70952055c9a7b9110842ed7a954be4bfe68346))
* address senior engineer audit of swagger UI ([9833163](https://github.com/MacXsimilian/kube-phoenix/commit/9833163d3499baed4f4eb1622fb9523963eab64b))
* address swagger UI audit issues ([86092a8](https://github.com/MacXsimilian/kube-phoenix/commit/86092a8517306f62ae34e709c276c217e7db9494))
* **api:** align handlers with camelCase JSON convention ([43a9cae](https://github.com/MacXsimilian/kube-phoenix/commit/43a9cae23ebf441ed058ec59842a0d74ec615bc4))
* audit findings — logging, WS goroutine safety, drain reliability, count persistence ([86fc745](https://github.com/MacXsimilian/kube-phoenix/commit/86fc745b0c759d39b515f7490a1387bf2bf0ca7f))
* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([1175578](https://github.com/MacXsimilian/kube-phoenix/commit/1175578868291c8457500e4d12b3b567fb6ca448))
* **backend:** check fmt.Fprintf error in SSE handler ([3496742](https://github.com/MacXsimilian/kube-phoenix/commit/3496742df304e53c8e16e9431d7c7db1bf6d7ba6))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([7f18502](https://github.com/MacXsimilian/kube-phoenix/commit/7f18502c7e18cb6dfb8f82ce94e613dddc103650))
* cache invalidation gaps, error handling, and UX improvements ([de59a5d](https://github.com/MacXsimilian/kube-phoenix/commit/de59a5dcea3a5f1ed7b9e0a16d9238259101d6a3))
* cache invalidation gaps, error handling, and UX improvements ([928c03e](https://github.com/MacXsimilian/kube-phoenix/commit/928c03eab33deec6428b2fd13fb89af95112bc5b))
* check json.Encode error in createSchedule 201 response ([3cbf365](https://github.com/MacXsimilian/kube-phoenix/commit/3cbf3650173c30e28cb6bd994d8c4bb9e4326c7f))
* check stream.Close error return to satisfy errcheck linter ([56130d0](https://github.com/MacXsimilian/kube-phoenix/commit/56130d0f84d9af277fa9e1811d144d845042659c))
* **ci:** align versions, add caching and timeouts ([4f7a0b6](https://github.com/MacXsimilian/kube-phoenix/commit/4f7a0b6c53f309a697ca7cf5a19c7d86141a0c3a))
* **ci:** audit fixes across all workflows ([ba54905](https://github.com/MacXsimilian/kube-phoenix/commit/ba54905a8adaf867a806edadf68438034f54cb51))
* **ci:** bump Go to 1.25.8 to patch GO-2026-4601 and GO-2026-4602 ([f701e0c](https://github.com/MacXsimilian/kube-phoenix/commit/f701e0cf09ac1261d908396b317bf693e1e23205))
* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([3c63b9f](https://github.com/MacXsimilian/kube-phoenix/commit/3c63b9f7414e5276234466864b922336ac4971a9))
* **ci:** exclude gosec G706 false positive for structured slog calls ([ae7c719](https://github.com/MacXsimilian/kube-phoenix/commit/ae7c71926ded7c5c725046870d76638906c73991))
* **ci:** fix backend test GITHUB_OUTPUT format error ([e427658](https://github.com/MacXsimilian/kube-phoenix/commit/e427658b439b831f5ad62951ff292ab9c48bff69))
* **ci:** fix govulncheck GITHUB_OUTPUT format error ([79662f5](https://github.com/MacXsimilian/kube-phoenix/commit/79662f5748434d9e1a98627bcc62de21408c619f))
* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([4a0c2aa](https://github.com/MacXsimilian/kube-phoenix/commit/4a0c2aa614e35ff4191160b842ebd1afe631cbd0))
* **ci:** restore go-version to 1.25 to match go.mod ([bcf637d](https://github.com/MacXsimilian/kube-phoenix/commit/bcf637d4166b144017409197b29a01fd357da2f2))
* **ci:** revert to npm install until package-lock.json is committed ([9775c4a](https://github.com/MacXsimilian/kube-phoenix/commit/9775c4a67ebd473095f485f65ffab5c117d14f82))
* **ci:** run secret scan on push and PRs, not PRs only ([5f3f3aa](https://github.com/MacXsimilian/kube-phoenix/commit/5f3f3aa7b1084f506847dea7da53cbd926dfebc7))
* **ci:** skip SARIF upload when Trivy output file is missing ([68bca50](https://github.com/MacXsimilian/kube-phoenix/commit/68bca50dafcf2b33dc0e01ff8dc96c8dd53438fe))
* **ci:** use valid codeql-action SHA for SARIF upload ([1248a69](https://github.com/MacXsimilian/kube-phoenix/commit/1248a69d7b616fbfc2ffe83150ce1c4189f78ab7))
* **cluster:** add React import for React.Fragment in NodeDetailDrawer ([8f9bfc3](https://github.com/MacXsimilian/kube-phoenix/commit/8f9bfc3281fb9e420d07bfdd735da7f21e25589e))
* **font:** self-host Inter via next/font — no runtime CDN requests ([9f4eb5d](https://github.com/MacXsimilian/kube-phoenix/commit/9f4eb5d9aff71aabbd4e8b4794d1d01658127d6c))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([221e5c7](https://github.com/MacXsimilian/kube-phoenix/commit/221e5c7ff648344088ddaffbcd5b4eb96e8b4f6c))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([c8b634f](https://github.com/MacXsimilian/kube-phoenix/commit/c8b634f8746ad267bffeb2332e04159e0e97eb2b))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([b2fb49c](https://github.com/MacXsimilian/kube-phoenix/commit/b2fb49cf83ca090da2ba98e9c9f0d41124efb803))
* **frontend:** address UI audit findings ([de3a835](https://github.com/MacXsimilian/kube-phoenix/commit/de3a835e0bc3c2243d46366b689dfa6ae04d6ee7))
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([58f39cd](https://github.com/MacXsimilian/kube-phoenix/commit/58f39cd09ee412a2f31e052bcaa8d62ecf05b7fc))
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([bc33ec9](https://github.com/MacXsimilian/kube-phoenix/commit/bc33ec9dd2e88f4210e6a5397180fd6db7ffa23b))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([b3ea134](https://github.com/MacXsimilian/kube-phoenix/commit/b3ea13435d32314bee371e0804b4ccc56ac2f102))
* **frontend:** surface silent mutation/query failures across all components ([43fac2d](https://github.com/MacXsimilian/kube-phoenix/commit/43fac2dbbb4b2d8d1c795427e2465b5c1c4704a4))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([60ed991](https://github.com/MacXsimilian/kube-phoenix/commit/60ed9912e3cf781388017e3e297b1758617e2d35))
* gofmt -s formatting and update stale version refs in docs ([058cdbb](https://github.com/MacXsimilian/kube-phoenix/commit/058cdbbca2ecc740bf94fbc6ccf56218c1d8730c))
* gofmt -s formatting and update stale version refs in docs ([01900e5](https://github.com/MacXsimilian/kube-phoenix/commit/01900e51909352b0a2657b811a4e0f4f05ee1aec))
* grant packages: write at workflow level for reusable docker workflow ([70c2786](https://github.com/MacXsimilian/kube-phoenix/commit/70c2786d7b8a0632d8a6998acb47123ca774e58c))
* **helm:** address chart audit findings ([b32088c](https://github.com/MacXsimilian/kube-phoenix/commit/b32088cb61e2d9aea7fedc020923b2a94b40fbdc))
* **helm:** harden security and add missing templates ([8bde8b1](https://github.com/MacXsimilian/kube-phoenix/commit/8bde8b107fdbd3ef52cd7ba68df3162a3aa4a9a9))
* **helm:** stamp chart version and appVersion from git tag at release time ([37c8a7b](https://github.com/MacXsimilian/kube-phoenix/commit/37c8a7bfff13d641955c36a18e0007dec82418ca))
* **helm:** sync chart version to 0.1.17 ([3f20c2b](https://github.com/MacXsimilian/kube-phoenix/commit/3f20c2b162db93b63da7be68e6f9879ed03e3b0c))
* history UX corrections and browser native auth popup ([4fd454d](https://github.com/MacXsimilian/kube-phoenix/commit/4fd454d159bdf88c5232532128a467d9ebe881a2))
* history UX corrections and browser native auth popup ([72107eb](https://github.com/MacXsimilian/kube-phoenix/commit/72107eb04c8ebb3d079f13f63aaa07ec90d17a2e))
* **history:** cast Box ref type to HTMLElement in LogViewer ([187f406](https://github.com/MacXsimilian/kube-phoenix/commit/187f4065c102f2b34d15f66e92f4d0eeda1584bc))
* **history:** show correct arrow direction and hide drained chip for wake executions ([34a4545](https://github.com/MacXsimilian/kube-phoenix/commit/34a4545cd0172d0aeac14a37ee81965cefd337ec))
* input validation, error sanitisation, and CORS hardening ([f2d0772](https://github.com/MacXsimilian/kube-phoenix/commit/f2d0772edf8803b61ae3c96bd892813f7b88098a))
* input validation, error sanitisation, and CORS hardening ([4bd8b5f](https://github.com/MacXsimilian/kube-phoenix/commit/4bd8b5f848ff288563b832cba65e51103af973b0))
* **layout:** remove double margin-left pushing content off-center ([7c034cf](https://github.com/MacXsimilian/kube-phoenix/commit/7c034cf683c3df6f9da658ce47cd452d307e9986))
* **logviewer:** remove log count badge, fix scroll and jump-to-error ([8614445](https://github.com/MacXsimilian/kube-phoenix/commit/8614445c1db4958ff36ccb25dffd3f9ba56083e7))
* **logviewer:** summary closed by default, logs in collapsible accordion open by default ([ab24ceb](https://github.com/MacXsimilian/kube-phoenix/commit/ab24ceb9816b66486ef43ee998c5ec5becbf4e7a))
* lowercase GHCR owner for OCI Helm chart push ([c809dad](https://github.com/MacXsimilian/kube-phoenix/commit/c809dad6cd48803fa5f4396985181f8c7ff76932))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([e697775](https://github.com/MacXsimilian/kube-phoenix/commit/e697775b5ef5fd9168cb852a78e784c9b4220400))
* **metrics:** log HTTP status code on metrics API failure ([9b8ecda](https://github.com/MacXsimilian/kube-phoenix/commit/9b8ecda28134ece538c61bf58b7514f16efc813f))
* **metrics:** log HTTP status code on metrics API failure ([c5c005e](https://github.com/MacXsimilian/kube-phoenix/commit/c5c005e9e0dfd36a44ed488477ed756fee794ece))
* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([eb1321c](https://github.com/MacXsimilian/kube-phoenix/commit/eb1321caf1f1eb07452fcc1af34f950633133d10))
* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([8033edb](https://github.com/MacXsimilian/kube-phoenix/commit/8033edb48b4c7aa1bb2c820bfc47a432be3c3bb4))
* migrate release-please to googleapis/release-please-action v4.4.0 ([08f49ce](https://github.com/MacXsimilian/kube-phoenix/commit/08f49ce8e11b2a2dfc4520ef06d3b4e710d52b22))
* **oidc:** correct OIDCSubject column name ([#172](https://github.com/MacXsimilian/kube-phoenix/issues/172)) ([44f0313](https://github.com/MacXsimilian/kube-phoenix/commit/44f03131efd2171b0870d9f0d8372dfb67e70799))
* **oidc:** separate local and OIDC user accounts ([#170](https://github.com/MacXsimilian/kube-phoenix/issues/170)) ([35d7e0b](https://github.com/MacXsimilian/kube-phoenix/commit/35d7e0b4023dc72bdd1ca2ab24e804bb5fbdf8eb))
* **oidc:** use proper PKCE verifier instead of reusing state ([#167](https://github.com/MacXsimilian/kube-phoenix/issues/167)) ([5da7e9f](https://github.com/MacXsimilian/kube-phoenix/commit/5da7e9f06b32d0ca5c3d9881f92472c545505edd))
* **openapi:** rewrite spec to match actual API behavior ([b47193e](https://github.com/MacXsimilian/kube-phoenix/commit/b47193eb771e5b31b7c5e37d7369528a428cb30d))
* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([29f7c97](https://github.com/MacXsimilian/kube-phoenix/commit/29f7c97b838db3870d6e1d20125e5379c852579b))
* **overview:** equal-height cards + update docs for reorder and position field ([7a9a594](https://github.com/MacXsimilian/kube-phoenix/commit/7a9a594dbac3014589b994d7c8a73ce75426974e))
* **overview:** open log drawer after trigger instead of navigating to history ([34a4545](https://github.com/MacXsimilian/kube-phoenix/commit/34a4545cd0172d0aeac14a37ee81965cefd337ec))
* **overview:** pin time indicator to right edge in activity feed, fix wake label ([8e61293](https://github.com/MacXsimilian/kube-phoenix/commit/8e61293e8e3bb52a21374cfaaf2732421a86e938))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([05adda5](https://github.com/MacXsimilian/kube-phoenix/commit/05adda50f72a2c49ee3803614bdc51088e6e35b8))
* pull About modal version from package.json instead of hardcoding ([3959254](https://github.com/MacXsimilian/kube-phoenix/commit/3959254d0a4339b2570422aa60e7b441dbd2585e))
* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([8ac7b6f](https://github.com/MacXsimilian/kube-phoenix/commit/8ac7b6f6a5812c0bf99ca7a9511f0576a142aa99))
* **release:** run docker build and helm publish inside release-please workflow ([078d8c2](https://github.com/MacXsimilian/kube-phoenix/commit/078d8c21f26826c38eda9f58bf7df082eb659052))
* remove npm cache — no package-lock.json in repo ([48b7a4b](https://github.com/MacXsimilian/kube-phoenix/commit/48b7a4baf895bdfc1421a7947a639347bfcd5350))
* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([c389353](https://github.com/MacXsimilian/kube-phoenix/commit/c389353a2bb4cceae978a2c9b4294ccc1325af83))
* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([0487954](https://github.com/MacXsimilian/kube-phoenix/commit/0487954a9ca393daea95fa707aab1c3aa53aa0ef))
* replace release-please action with npx CLI to avoid action policy restriction ([d8d6cb5](https://github.com/MacXsimilian/kube-phoenix/commit/d8d6cb5345cdc012a680939e4941670244bf8ccf))
* resolve all errcheck lint findings ([0658018](https://github.com/MacXsimilian/kube-phoenix/commit/065801840659d0edf04e437fb54878b70883aaa4))
* resolve frontend and backend CI build failures ([107cc44](https://github.com/MacXsimilian/kube-phoenix/commit/107cc44e950cd84a11384163584f83cf2d378ef7))
* resolve next.config.ts and go embed CI failures ([a1a43c8](https://github.com/MacXsimilian/kube-phoenix/commit/a1a43c834234c42883fc1f20b1fafaabb21b8523))
* resolve TypeScript and go vet CI failures ([86e5576](https://github.com/MacXsimilian/kube-phoenix/commit/86e557611857d75aa8ef8d788a45e166004ad19d))
* restore release-please action now that policy allows google-github-actions/* ([2f4d42f](https://github.com/MacXsimilian/kube-phoenix/commit/2f4d42faf2b906c9574b585412970197f7930476))
* return clear permission-denied message on 403 ([d1da3d7](https://github.com/MacXsimilian/kube-phoenix/commit/d1da3d724ad257cede2d71477f209f58e64c6106))
* revert embedded openapi.yaml tracking; add CI sync assertion ([6fa3198](https://github.com/MacXsimilian/kube-phoenix/commit/6fa3198575573872e727ef3e88b5aded0e2c7616))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([6ccaed3](https://github.com/MacXsimilian/kube-phoenix/commit/6ccaed315d3b93fefdda55b29a19e493a3fbe4ee))
* **scaler:** align scale_down with original cronjob logic ([697c623](https://github.com/MacXsimilian/kube-phoenix/commit/697c62322ce2b183033db4c5d37b5fc0b22ba7d9))
* schedule toggle persistence, next-run UX, double-v version ([1701fe3](https://github.com/MacXsimilian/kube-phoenix/commit/1701fe3b70f53618b8677195bf729d5e17653738))
* **scheduler:** detach manual trigger from HTTP request context ([a89de39](https://github.com/MacXsimilian/kube-phoenix/commit/a89de3964493baa14fcbba17e84b1de7cd27ae3b))
* **schedules:** move dnd modifiers to correct package ([5192893](https://github.com/MacXsimilian/kube-phoenix/commit/5192893e93ed61e92f504cfc1b931e4ec2d997ae))
* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([5a5fbef](https://github.com/MacXsimilian/kube-phoenix/commit/5a5fbef6c2e13f03d317aa9da58c4859fc427a8a))
* **schedules:** resolve stale closure causing toggle not to persist ([feedd3b](https://github.com/MacXsimilian/kube-phoenix/commit/feedd3bdc9c62799632cf555451102bda63afa97))
* **schedules:** resolve stale closure causing toggle not to persist ([e44a1c7](https://github.com/MacXsimilian/kube-phoenix/commit/e44a1c7b68ed2d2fd620bfe01ac830871051cc0c))
* **security:** redact WS token from logs, fix RBAC replicasets, add reset-db audit log ([713931f](https://github.com/MacXsimilian/kube-phoenix/commit/713931f91c9b5a3f7f94d5546d8551d7a462093f))
* **security:** redact WS token from logs, fix RBAC, add reset-db audit log ([fb97664](https://github.com/MacXsimilian/kube-phoenix/commit/fb976642c9bc3824ad07ffe7ccfa2e8682c0537f))
* timeUntil shows days for countdowns over 24h ([7b2a1df](https://github.com/MacXsimilian/kube-phoenix/commit/7b2a1df38c46062c32410e34c303adc2ef01c7fd))
* track embedded openapi.yaml so go:embed resolves on CI ([db5b050](https://github.com/MacXsimilian/kube-phoenix/commit/db5b0508ec0d11157d21f0b59eb95cb347a30386))
* **ui:** rework light mode — fix all hardcoded dark colors ([ed13657](https://github.com/MacXsimilian/kube-phoenix/commit/ed1365773cdd1f1f2acb7ed42908bc56bdc2406c))
* **ui:** WCAG AA light mode colors + settings layout tweaks ([6baa8bf](https://github.com/MacXsimilian/kube-phoenix/commit/6baa8bf9183ae2f6f216f44fe5d97f94a4f42a23))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([777c45c](https://github.com/MacXsimilian/kube-phoenix/commit/777c45c07fb4a69ebf7b252c156ac05505acda2e))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([408c4f6](https://github.com/MacXsimilian/kube-phoenix/commit/408c4f604a96845e0b3ba4e873a2da09915efb5b))
* use NewRequestWithContext in auth tests (noctx lint) ([bd1e7fe](https://github.com/MacXsimilian/kube-phoenix/commit/bd1e7fecec1ba368781c8c44d534ef2c29a809d4))
* use npm install in Dockerfile (no package-lock.json) ([c523131](https://github.com/MacXsimilian/kube-phoenix/commit/c523131d2852205f105e2d88fb80911b698c70ff))
* wrap ActivityFeed siblings in Fragment to resolve JSX syntax error ([b277b77](https://github.com/MacXsimilian/kube-phoenix/commit/b277b778b21eead203dfc46665b0d5e602254a73))


### Performance Improvements

* **overview:** cluster cache, SSE stream, and overview endpoint ([7bab083](https://github.com/MacXsimilian/kube-phoenix/commit/7bab08324b84e9be4830401b93cd06d4636bfd18))
* **overview:** cluster cache, SSE stream, and overview endpoint ([78cbba3](https://github.com/MacXsimilian/kube-phoenix/commit/78cbba3aff9e146471ed9a638e70ad61925516cd))

## [0.1.77](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.76...v0.1.77) (2026-03-21)


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
* **oidc:** add TLS skip verify and custom CA cert support ([23097a7](https://github.com/MacXsimilian/kube-phoenix/commit/23097a72628f04802ae40b017f31fdd292890433))

## [0.1.73](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.72...v0.1.73) (2026-03-21)


### Features

* **db:** upgrade PostgreSQL from 16 to 17.7 ([4e827a8](https://github.com/MacXsimilian/kube-phoenix/commit/4e827a8d49091a2416653c4c30e65ed520bca36a))
* **db:** upgrade PostgreSQL from 16 to 17.7 ([16527ab](https://github.com/MacXsimilian/kube-phoenix/commit/16527ab258e2c52cf499fd1555240f15f1de1eab))


### Bug Fixes

* **ci:** fix backend test GITHUB_OUTPUT format error ([e427658](https://github.com/MacXsimilian/kube-phoenix/commit/e427658b439b831f5ad62951ff292ab9c48bff69))
* **ci:** fix govulncheck GITHUB_OUTPUT format error ([79662f5](https://github.com/MacXsimilian/kube-phoenix/commit/79662f5748434d9e1a98627bcc62de21408c619f))
* **ui:** WCAG AA light mode colors + settings layout tweaks ([6baa8bf](https://github.com/MacXsimilian/kube-phoenix/commit/6baa8bf9183ae2f6f216f44fe5d97f94a4f42a23))

## [0.1.72](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.71...v0.1.72) (2026-03-20)


### Features

* **build:** add BuildKit cache mounts and Docker CI validation ([8239829](https://github.com/MacXsimilian/kube-phoenix/commit/8239829583c72c4725f3ebc4bbcd4966d58458bb))
* **build:** add BuildKit cache mounts and Docker CI validation ([96d43f0](https://github.com/MacXsimilian/kube-phoenix/commit/96d43f04bff3e1e7696f810a06c8fe66f371629f))

## [0.1.71](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.70...v0.1.71) (2026-03-20)


### Features

* **settings:** add OIDC config status checker ([1e038af](https://github.com/MacXsimilian/kube-phoenix/commit/1e038af460f3b62949a63861c46a755dba554235))
* **settings:** OIDC config status checker ([86ba7f0](https://github.com/MacXsimilian/kube-phoenix/commit/86ba7f0a4d9cd67a68a28653957ca8883732e385))

## [0.1.70](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.69...v0.1.70) (2026-03-20)


### Features

* **helm:** harden chart with missing production features ([57aa120](https://github.com/MacXsimilian/kube-phoenix/commit/57aa120f31b96b4202e25bf1837b6368969a859d))
* **helm:** harden chart with missing production features ([67970c6](https://github.com/MacXsimilian/kube-phoenix/commit/67970c6f2890889528333a2e3078b088d5ee0b21))

## [0.1.69](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.68...v0.1.69) (2026-03-20)


### Features

* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([634bffa](https://github.com/MacXsimilian/kube-phoenix/commit/634bffaae06f31db31274b4b6bfa72c083395050))
* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([78eee8b](https://github.com/MacXsimilian/kube-phoenix/commit/78eee8b5650fb0495fc96cd130a40d00b6feeaa4))
* add preventive RBAC UI guards on all mutation buttons ([90aaadb](https://github.com/MacXsimilian/kube-phoenix/commit/90aaadb30be2bc220eeadc78fc81ae22dd809c77))


### Bug Fixes

* return clear permission-denied message on 403 ([78e244c](https://github.com/MacXsimilian/kube-phoenix/commit/78e244cfe2dde95e825a791ff25550c9dc7c2102))
* use NewRequestWithContext in auth tests (noctx lint) ([2b2ba4d](https://github.com/MacXsimilian/kube-phoenix/commit/2b2ba4d1f06ecacfcf1a8b3fe1e0537d69977556))

## [0.1.68](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.67...v0.1.68) (2026-03-17)


### Features

* add streaming pod log viewer to pod detail ([eee065c](https://github.com/MacXsimilian/kube-phoenix/commit/eee065c4ef7f51f36218dfa17e2748c9c2622983))
* **cluster:** add streaming pod log viewer to pod detail ([899bb8c](https://github.com/MacXsimilian/kube-phoenix/commit/899bb8c773593e4c9de9e8546cd80a1ef17e0289))

## [0.1.67](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.66...v0.1.67) (2026-03-17)


### Features

* add streaming pod log viewer to cluster drawer ([f381091](https://github.com/MacXsimilian/kube-phoenix/commit/f381091a1c1e9808c2c5fa5ddeca47b37922e54a))
* add streaming pod log viewer to cluster drawer ([bf3ca39](https://github.com/MacXsimilian/kube-phoenix/commit/bf3ca39f86cc5ac99e5726f244ccb4cf357cce09))


### Bug Fixes

* check stream.Close error return to satisfy errcheck linter ([5b4b61f](https://github.com/MacXsimilian/kube-phoenix/commit/5b4b61f939d329e579426dc528dcf7261be3b88c))

## [0.1.66](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.65...v0.1.66) (2026-03-16)


### Bug Fixes

* gofmt -s formatting and update stale version refs in docs ([bbbabf0](https://github.com/MacXsimilian/kube-phoenix/commit/bbbabf0ad3356ef993bae48693a033193f8ce13e))
* gofmt -s formatting and update stale version refs in docs ([27abe0a](https://github.com/MacXsimilian/kube-phoenix/commit/27abe0a67df0e5e4281535ca886d87569c4ba8f9))

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
* replace cron text field with visual CronBuilder in schedule dialog ([0a56851](https://github.com/MacXsimilian/kube-phoenix/commit/0a5685120d4e6f0b5febfccb420fb8e72adbc225))


### Bug Fixes

* revert embedded openapi.yaml tracking; add CI sync assertion ([b47f7ea](https://github.com/MacXsimilian/kube-phoenix/commit/b47f7ea7b733a8db07d4bc0b53e7ba41c918508b))
* track embedded openapi.yaml so go:embed resolves on CI ([9ce583e](https://github.com/MacXsimilian/kube-phoenix/commit/9ce583e14c01ce690df69d78311198285cc9aa6e))

## [0.1.62](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.61...v0.1.62) (2026-03-16)


### Features

* add Prometheus metrics endpoint at /metrics ([61a2d0e](https://github.com/MacXsimilian/kube-phoenix/commit/61a2d0efea777ea4b6819a0e1ca573521eda8db5))
* add Prometheus metrics endpoint at /metrics ([aa2b8c5](https://github.com/MacXsimilian/kube-phoenix/commit/aa2b8c55dd522e7ae66d17eb5a205e0647b1b2f9))


### Bug Fixes

* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([e31bce4](https://github.com/MacXsimilian/kube-phoenix/commit/e31bce4b7d864a790343f217107f20bdc3a7f90d))
* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([3631928](https://github.com/MacXsimilian/kube-phoenix/commit/3631928e2df6854dfbbebc3de0377daa445bf0f6))

## [0.1.61](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.60...v0.1.61) (2026-03-16)


### Bug Fixes

* add WWW-Authenticate header so browsers prompt for credentials ([e7f3e1e](https://github.com/MacXsimilian/kube-phoenix/commit/e7f3e1e00d5633c1a636034b8b829077df33692a))
* add WWW-Authenticate header so browsers prompt for credentials ([8592466](https://github.com/MacXsimilian/kube-phoenix/commit/859246623bc6d65e572afe5445c4bc9217349104))

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
