# Changelog

## [0.1.81](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.80...v0.1.81) (2026-03-22)


### Features

* add About modal triggered from kube-phoenix title ([5b9f292](https://github.com/MacXsimilian/kube-phoenix/commit/5b9f2920478ec793a1f05a9d5c680ed6b45fbdb2))
* add light/dark/system theme mode switcher ([26aa33c](https://github.com/MacXsimilian/kube-phoenix/commit/26aa33c580ca2a33a375417dea585c401b16dc50))
* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([09092ad](https://github.com/MacXsimilian/kube-phoenix/commit/09092ad5c9c903844a80d4113f45e1e9fe5b102f))
* add multi-user management with RBAC, audit logging, and Keycloak OIDC ([ed38a34](https://github.com/MacXsimilian/kube-phoenix/commit/ed38a34560d512173a2a8974e22857b3dd97ef98))
* add preventive RBAC UI guards on all mutation buttons ([6cb5da1](https://github.com/MacXsimilian/kube-phoenix/commit/6cb5da1d9f16947c5ae53ce2c764fed85510e4d7))
* add Prometheus metrics endpoint at /metrics ([cd11f95](https://github.com/MacXsimilian/kube-phoenix/commit/cd11f95aece7bbbc2da7c00e9f3051a75a548460))
* add Prometheus metrics endpoint at /metrics ([9c95756](https://github.com/MacXsimilian/kube-phoenix/commit/9c95756875da81e8b40a9837268e96f15e26b906))
* add streaming pod log viewer to cluster drawer ([7eb31fa](https://github.com/MacXsimilian/kube-phoenix/commit/7eb31fa19a08df95bb90e26c0a0232794324a4ec))
* add streaming pod log viewer to cluster drawer ([002edfe](https://github.com/MacXsimilian/kube-phoenix/commit/002edfe63fcae6f6a8e6ba58050d7f7dbb1de7a7))
* add streaming pod log viewer to pod detail ([b738cd0](https://github.com/MacXsimilian/kube-phoenix/commit/b738cd0a250693f1454356b6f7c3317ede2a8ca6))
* add system-protected namespaces with deletion confirmation ([434ddf2](https://github.com/MacXsimilian/kube-phoenix/commit/434ddf2027d5fd64630882b86f124226de7a8151))
* branded login screen, nav reorder, inline log drawer, and docs ([7935c8f](https://github.com/MacXsimilian/kube-phoenix/commit/7935c8f00e676ea38e381996e06fdff92408a745))
* **build:** add BuildKit cache mounts and Docker CI validation ([9baaa24](https://github.com/MacXsimilian/kube-phoenix/commit/9baaa249f6bdc8ba5e92cf01e5f5de990c3ccb5b))
* **build:** add BuildKit cache mounts and Docker CI validation ([b0d6e0c](https://github.com/MacXsimilian/kube-phoenix/commit/b0d6e0c738cd7ee0992dbc07555ae2444fcaa4ef))
* **cluster:** add streaming pod log viewer to pod detail ([8d493b5](https://github.com/MacXsimilian/kube-phoenix/commit/8d493b5ed74e1a6ba6a8af27e74381f766073bfa))
* **cluster:** node pod drawer, workload kind labels, chart version sync ([d99eea8](https://github.com/MacXsimilian/kube-phoenix/commit/d99eea88f18f9e43085fc945e5c668295e2c26f9))
* **cluster:** pod detail and workload detail drawers ([88f11e0](https://github.com/MacXsimilian/kube-phoenix/commit/88f11e048245b396da87e70f2ef5506901556ca9))
* **cluster:** show actual CPU/mem usage in node and workload pod lists ([c07c3fd](https://github.com/MacXsimilian/kube-phoenix/commit/c07c3fdfc4e57423260a7078dcd73b8f9b7f08ff))
* **cluster:** show actual CPU/mem usage in node and workload pod lists ([237d22d](https://github.com/MacXsimilian/kube-phoenix/commit/237d22d9f81ba8885cbad963ad4147f291a27d5d))
* **cluster:** sortable tables, zone grouping, CPU/mem bars, node age, cordon status, ready replicas, affected-only filter ([2263ef3](https://github.com/MacXsimilian/kube-phoenix/commit/2263ef3993c16dbaade0c2e415eb941d431e8401))
* custom auth UI, pod metrics, and cluster detail improvements ([d09f89e](https://github.com/MacXsimilian/kube-phoenix/commit/d09f89ea929f46ade347b13b1c60696207c5c9e3))
* **db:** upgrade PostgreSQL from 16 to 17.7 ([d9e6980](https://github.com/MacXsimilian/kube-phoenix/commit/d9e6980c5dd7ffc7d730e7f705f919e4bdfa6b26))
* **db:** upgrade PostgreSQL from 16 to 17.7 ([86e8301](https://github.com/MacXsimilian/kube-phoenix/commit/86e830127a0151fb45af7c7e27cc86d31faa1fc9))
* **frontend:** resizable log drawer with drag handle ([11db661](https://github.com/MacXsimilian/kube-phoenix/commit/11db6614bc65983beb39f5046b8d4cce04753898))
* **frontend:** responsive layout with collapsible sidebar ([4062684](https://github.com/MacXsimilian/kube-phoenix/commit/4062684366c55a215dd48bcb5bbdd8084ebd1817))
* **frontend:** UI improvements, bug fixes, and cluster state enhancements ([c5e8b94](https://github.com/MacXsimilian/kube-phoenix/commit/c5e8b940b5bb377f58eb39896c048277b19be9c9))
* **frontend:** UX improvements and README overhaul ([50592db](https://github.com/MacXsimilian/kube-phoenix/commit/50592db09a1b95dcc13c9721bd7ae06e898e5ade))
* **guardrails:** system-protected namespaces with deletion confirmation ([27c6c1a](https://github.com/MacXsimilian/kube-phoenix/commit/27c6c1afebee424ce48671d92c7c64af61f1f7ea))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([31ada1f](https://github.com/MacXsimilian/kube-phoenix/commit/31ada1fe0ff643c7e1817ecd071ad73f6a293115))
* **helm:** harden chart with missing production features ([6248791](https://github.com/MacXsimilian/kube-phoenix/commit/62487910ad1883f6ff58f01bfc8793670487bd9d))
* **helm:** harden chart with missing production features ([4ab2389](https://github.com/MacXsimilian/kube-phoenix/commit/4ab23892de0e686cf19ce6a1037bc2b221258bcc))
* light/dark/system theme mode switcher ([89bcfef](https://github.com/MacXsimilian/kube-phoenix/commit/89bcfefbc05930385128bab0ee00bffabdb8e050))
* **oidc:** add TLS skip verify and custom CA cert support ([a309562](https://github.com/MacXsimilian/kube-phoenix/commit/a3095628771decde0072927ee86d9c202831ea05))
* **oidc:** add TLS skip verify and custom CA cert support ([abbf762](https://github.com/MacXsimilian/kube-phoenix/commit/abbf7629e18a0a6b1ebe7131e2d00508be49e858))
* **oidc:** RP-initiated logout to terminate Keycloak session ([#180](https://github.com/MacXsimilian/kube-phoenix/issues/180)) ([af457f2](https://github.com/MacXsimilian/kube-phoenix/commit/af457f2aa1e0e7d9cc0c3d681e903a181fca21d3))
* **oidc:** user profile sync, DB hardening, API docs overhaul ([#176](https://github.com/MacXsimilian/kube-phoenix/issues/176)) ([851db9f](https://github.com/MacXsimilian/kube-phoenix/commit/851db9f996974ad5d69bb3f24b8dfaef45d4e156))
* **overview:** clickable workload chips, all schedules in order, view-all links, running execution label ([da8c1b5](https://github.com/MacXsimilian/kube-phoenix/commit/da8c1b5dfa0fb975e406de30c387448478a6351e))
* **overview:** next-run countdown, partial state, deep-link activity feed ([5f92a46](https://github.com/MacXsimilian/kube-phoenix/commit/5f92a469225fa8c30901c72489917eea4fc8f804))
* **overview:** remove Schedules card, fix activity feed UX, add README badges ([3725907](https://github.com/MacXsimilian/kube-phoenix/commit/3725907e01087361b40faa82ee32150b1fa501d2))
* replace cron text field with visual CronBuilder in schedule dialog ([f8d6c1f](https://github.com/MacXsimilian/kube-phoenix/commit/f8d6c1f24e66931e1b5a2a2f9b5fa796d6c31f8b))
* replace cron text field with visual CronBuilder in schedule dialog ([5d7f90e](https://github.com/MacXsimilian/kube-phoenix/commit/5d7f90e83b87be38206cc9d2d98b2a94c12ad9e5))
* **schedules:** add inline toggle feedback — spinner, Saved label, F… ([853f80c](https://github.com/MacXsimilian/kube-phoenix/commit/853f80cee93d7d840ba9a9370afe3fc1fadfd0a0))
* **schedules:** add inline toggle feedback — spinner, Saved label, Failed state ([65587a4](https://github.com/MacXsimilian/kube-phoenix/commit/65587a4c8661bac4aee781c4c1635f04e372eaca))
* **schedules:** drag-and-drop reordering persisted per schedule type ([9f941dc](https://github.com/MacXsimilian/kube-phoenix/commit/9f941dcb01137d742279b96d8e715d49a252a738))
* **schedules:** drag-and-drop reordering persisted per schedule type ([0336972](https://github.com/MacXsimilian/kube-phoenix/commit/03369727548ffc9ed9ae2d885a7be930b6c9b94e))
* serve Swagger UI at /api/docs/ ([8d591bc](https://github.com/MacXsimilian/kube-phoenix/commit/8d591bcc7c063916b36d2311323d8d4e74e82c1f))
* **settings:** add OIDC config status checker ([1984303](https://github.com/MacXsimilian/kube-phoenix/commit/1984303267b95377836dfd98daf45b6a634a7e9f))
* **settings:** add Reset Database with two-step confirmation ([4a8cc19](https://github.com/MacXsimilian/kube-phoenix/commit/4a8cc19ce74a9008896e1029a86becec2daaa570))
* **settings:** OIDC config status checker ([68a6ec0](https://github.com/MacXsimilian/kube-phoenix/commit/68a6ec0f839ce9179e43ca601c6dbd32eb03aa5d))
* **ui:** add phoenix emoji favicon ([8afe4b6](https://github.com/MacXsimilian/kube-phoenix/commit/8afe4b6b3cc0b83600f753c36a8fd2b65b26e649))
* **ui:** execution summary, db reset stream, and UX improvements ([fdda305](https://github.com/MacXsimilian/kube-phoenix/commit/fdda305ba3a1b279d654ce2d903623b89bc2e407))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([c9da6dd](https://github.com/MacXsimilian/kube-phoenix/commit/c9da6dd64da2cf6139d3df85401458ebb88956cf))


### Bug Fixes

* add WWW-Authenticate header so browsers prompt for credentials ([4233ebc](https://github.com/MacXsimilian/kube-phoenix/commit/4233ebcfd58ab454186d39e0b086951b942c9b27))
* add WWW-Authenticate header so browsers prompt for credentials ([b9be2a1](https://github.com/MacXsimilian/kube-phoenix/commit/b9be2a12f54707add89a1b891d458bc51aa8ea6d))
* address audit findings — logging, WS goroutine leak, scaler drain safety, count persistence ([3f633ce](https://github.com/MacXsimilian/kube-phoenix/commit/3f633cea1755ecbe028c76a0b46196b0eb486d91))
* address senior engineer audit of swagger UI ([9e22656](https://github.com/MacXsimilian/kube-phoenix/commit/9e22656b097d781a2a6d4e1b23db0e446036dfa2))
* address swagger UI audit issues ([464029a](https://github.com/MacXsimilian/kube-phoenix/commit/464029ab73c6584c9f841094ced81c44db9a6df7))
* **api:** align handlers with camelCase JSON convention ([87fcda6](https://github.com/MacXsimilian/kube-phoenix/commit/87fcda609e6e53cf3ce94b1776b038229494e807))
* audit findings — logging, WS goroutine safety, drain reliability, count persistence ([7c71506](https://github.com/MacXsimilian/kube-phoenix/commit/7c715066895db8b21584b19dd02802dde3b36639))
* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([0529ed8](https://github.com/MacXsimilian/kube-phoenix/commit/0529ed86f73417e380765d95055dfc22b60697f2))
* **backend:** check fmt.Fprintf error in SSE handler ([0c2839e](https://github.com/MacXsimilian/kube-phoenix/commit/0c2839edc15f2164f7e63731ac01f8898ef440ec))
* **backend:** per-schedule execution timeout and WebSocket broker race fix ([e4dcc11](https://github.com/MacXsimilian/kube-phoenix/commit/e4dcc11c9e83efdef5f7649ca0c6fa36220bfcc2))
* cache invalidation gaps, error handling, and UX improvements ([6895f67](https://github.com/MacXsimilian/kube-phoenix/commit/6895f672849a76660f5c96d864581391976fb4a2))
* cache invalidation gaps, error handling, and UX improvements ([64ce7f8](https://github.com/MacXsimilian/kube-phoenix/commit/64ce7f877cbc9fbdedb848c93cb2a754b04f3c48))
* check json.Encode error in createSchedule 201 response ([244f32f](https://github.com/MacXsimilian/kube-phoenix/commit/244f32fbd7abf75ce1b4193427decd2ee833eb46))
* check stream.Close error return to satisfy errcheck linter ([91ef317](https://github.com/MacXsimilian/kube-phoenix/commit/91ef317ec5ae351e66f0db260763d9fe3b2eca67))
* **ci:** align versions, add caching and timeouts ([1a5b0df](https://github.com/MacXsimilian/kube-phoenix/commit/1a5b0df32f27f5f9314d8e825d5a9694097202a7))
* **ci:** audit fixes across all workflows ([0590e4f](https://github.com/MacXsimilian/kube-phoenix/commit/0590e4ff8518a639d899e59bc2638682392775ee))
* **ci:** bump Go to 1.25.8 to patch GO-2026-4601 and GO-2026-4602 ([6cfb500](https://github.com/MacXsimilian/kube-phoenix/commit/6cfb5008c8e0f3c7209add68255321c434239e36))
* **ci:** decouple Trivy scan from docker job — scan failure no longer marks build as failed ([6c4937e](https://github.com/MacXsimilian/kube-phoenix/commit/6c4937e283b7e1d0c4cbc0a42da2262c90af003a))
* **ci:** exclude gosec G706 false positive for structured slog calls ([0f1c9f5](https://github.com/MacXsimilian/kube-phoenix/commit/0f1c9f5f9b69e3619a6ce09acad36e1d58092ae2))
* **ci:** fix backend test GITHUB_OUTPUT format error ([1614cb0](https://github.com/MacXsimilian/kube-phoenix/commit/1614cb0683c50345f8785f8efa2d680d6a6bdf2f))
* **ci:** fix govulncheck GITHUB_OUTPUT format error ([c200ff1](https://github.com/MacXsimilian/kube-phoenix/commit/c200ff162651c40f63b1646ce6278c9579d79626))
* **ci:** remove helm publish from CI — release.yml owns versioned chart publishing ([8780c0e](https://github.com/MacXsimilian/kube-phoenix/commit/8780c0ef689b2a9be79a493507820f32c0ef5a93))
* **ci:** restore go-version to 1.25 to match go.mod ([5776947](https://github.com/MacXsimilian/kube-phoenix/commit/577694747dc5ff54a7b79fef2aa833b7830d10bb))
* **ci:** revert to npm install until package-lock.json is committed ([fe2ebfc](https://github.com/MacXsimilian/kube-phoenix/commit/fe2ebfcdec158e88042096c03cafbebb6cd67080))
* **ci:** run secret scan on push and PRs, not PRs only ([32a1011](https://github.com/MacXsimilian/kube-phoenix/commit/32a10118f09830d0ff4b64f61dd18b1c1668b01f))
* **ci:** skip SARIF upload when Trivy output file is missing ([c5e3070](https://github.com/MacXsimilian/kube-phoenix/commit/c5e30702ad53e63f4c79a468c2be70c628492bdd))
* **ci:** use valid codeql-action SHA for SARIF upload ([c6eb775](https://github.com/MacXsimilian/kube-phoenix/commit/c6eb775161d83ae8a88a415d1b7ef09c198a1c94))
* **cluster:** add React import for React.Fragment in NodeDetailDrawer ([33178b0](https://github.com/MacXsimilian/kube-phoenix/commit/33178b0b87907d94906f3c871e11182fc9e0543e))
* **font:** self-host Inter via next/font — no runtime CDN requests ([9191c0c](https://github.com/MacXsimilian/kube-phoenix/commit/9191c0c7ff51772156ef14bdfcdaf80bcfb7345b))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([092de60](https://github.com/MacXsimilian/kube-phoenix/commit/092de6030875fba45e2fe81cec53e906aa1373de))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([d11bac8](https://github.com/MacXsimilian/kube-phoenix/commit/d11bac82cda5573eae1fe086219413336380ae28))
* **formatters:** timeUntil now formats days for countdowns over 24 h ([152aba6](https://github.com/MacXsimilian/kube-phoenix/commit/152aba6bd2fdd0e72def682ec3bd837b152675a8))
* **frontend:** address UI audit findings ([38609cd](https://github.com/MacXsimilian/kube-phoenix/commit/38609cdcc135e885e9a63e5fa360006d84a107e4))
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([61c0974](https://github.com/MacXsimilian/kube-phoenix/commit/61c09743d8b4f39c868cb4e91edeced2af19dd52))
* **frontend:** audit tracks A, C, D, E — bugs, deduplication, UX, polish ([2e785e4](https://github.com/MacXsimilian/kube-phoenix/commit/2e785e4fc1853965bedc7adecb824f38fde35581))
* **frontend:** correct DoW cron range and add aria-current to sidebar nav ([9c2be21](https://github.com/MacXsimilian/kube-phoenix/commit/9c2be21faa841d5b6a9c4bfacd30061896217cb4))
* **frontend:** surface silent mutation/query failures across all components ([fbfe5b0](https://github.com/MacXsimilian/kube-phoenix/commit/fbfe5b0ea74fcf03f1b9e2f1a1c81e5df140fde2))
* **frontend:** wrap useSearchParams in Suspense boundary on cluster page ([cb09c3b](https://github.com/MacXsimilian/kube-phoenix/commit/cb09c3ba14138d33f417cad35febcc2f4eb2478c))
* gofmt -s formatting and update stale version refs in docs ([7ef0997](https://github.com/MacXsimilian/kube-phoenix/commit/7ef0997ff908ff60bfd2ef10ec65983aa148494b))
* gofmt -s formatting and update stale version refs in docs ([10f8c94](https://github.com/MacXsimilian/kube-phoenix/commit/10f8c94c7934dc7f8bd0658b30d386a66be628e7))
* grant packages: write at workflow level for reusable docker workflow ([c42815a](https://github.com/MacXsimilian/kube-phoenix/commit/c42815a0304ea764a752f00fa6080fdfbd33f062))
* **helm:** address chart audit findings ([a1fe29e](https://github.com/MacXsimilian/kube-phoenix/commit/a1fe29e5a7c0f0f0684b6e1d5a411d7550651fc5))
* **helm:** harden security and add missing templates ([9fd4b25](https://github.com/MacXsimilian/kube-phoenix/commit/9fd4b25d96c25ef411133fab4468d16e8e64b136))
* **helm:** stamp chart version and appVersion from git tag at release time ([a2e0384](https://github.com/MacXsimilian/kube-phoenix/commit/a2e0384f962a5b6db8accb3c7e176b1e33d50f64))
* **helm:** sync chart version to 0.1.17 ([136d633](https://github.com/MacXsimilian/kube-phoenix/commit/136d633a6765d1fd8f267da811016868af5729b8))
* history UX corrections and browser native auth popup ([1f77890](https://github.com/MacXsimilian/kube-phoenix/commit/1f778904a564367ba5ed5fe645e3b5dfd4f931e0))
* history UX corrections and browser native auth popup ([0d177cc](https://github.com/MacXsimilian/kube-phoenix/commit/0d177cc3f30eee6de8f2f476d931db68089ec3ad))
* **history:** cast Box ref type to HTMLElement in LogViewer ([4577e6d](https://github.com/MacXsimilian/kube-phoenix/commit/4577e6d8607c852a7550b75a2e10b8f81c83e77a))
* **history:** show correct arrow direction and hide drained chip for wake executions ([53e1bf5](https://github.com/MacXsimilian/kube-phoenix/commit/53e1bf5981201b78113446f4c44b0ea67d113bc4))
* input validation, error sanitisation, and CORS hardening ([df6837f](https://github.com/MacXsimilian/kube-phoenix/commit/df6837f8bfb0a8f84a942daa2fb55b913903c589))
* input validation, error sanitisation, and CORS hardening ([f125a90](https://github.com/MacXsimilian/kube-phoenix/commit/f125a90e3009a228288a0aea7e203bb070692748))
* **layout:** remove double margin-left pushing content off-center ([43bc10c](https://github.com/MacXsimilian/kube-phoenix/commit/43bc10c96e68609af7bf2c2b97e2a59e02fb21b3))
* **logviewer:** remove log count badge, fix scroll and jump-to-error ([45e48c8](https://github.com/MacXsimilian/kube-phoenix/commit/45e48c80cbf2f1bbea4974120dbe87acc77d12de))
* **logviewer:** summary closed by default, logs in collapsible accordion open by default ([8cd91ff](https://github.com/MacXsimilian/kube-phoenix/commit/8cd91ff635b670c184ceffffee6309962cd7ceeb))
* lowercase GHCR owner for OCI Helm chart push ([44da86e](https://github.com/MacXsimilian/kube-phoenix/commit/44da86eb0c377cf555be4590257e7ef437197bc6))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([82dda5c](https://github.com/MacXsimilian/kube-phoenix/commit/82dda5c0fc8ee1ee237779c69bb9a32ab351d9f7))
* **metrics:** log HTTP status code on metrics API failure ([b511f86](https://github.com/MacXsimilian/kube-phoenix/commit/b511f86184ad5eb35fb3b9727269973fb36d3cc4))
* **metrics:** log HTTP status code on metrics API failure ([de71641](https://github.com/MacXsimilian/kube-phoenix/commit/de716411b5b57bdc49569ff2df83f3fa82822b20))
* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([3057aec](https://github.com/MacXsimilian/kube-phoenix/commit/3057aec246d60f6b3235b02d9d91d83a05b941c4))
* **metrics:** surface API errors and add metrics.k8s.io RBAC rule ([7ecd8e6](https://github.com/MacXsimilian/kube-phoenix/commit/7ecd8e653a810ef0f1f0aac9a16c9f8149f2a35b))
* migrate release-please to googleapis/release-please-action v4.4.0 ([55d01fc](https://github.com/MacXsimilian/kube-phoenix/commit/55d01fcc9548d550ae0c62abd2b5acd218f0e80d))
* **oidc:** correct OIDCSubject column name ([#172](https://github.com/MacXsimilian/kube-phoenix/issues/172)) ([72b159f](https://github.com/MacXsimilian/kube-phoenix/commit/72b159f7b2089d4fe49e8f6f4faa5b3988666ee4))
* **oidc:** separate local and OIDC user accounts ([#170](https://github.com/MacXsimilian/kube-phoenix/issues/170)) ([1646af4](https://github.com/MacXsimilian/kube-phoenix/commit/1646af484c6e2d2c68d50b6a0c228ff59210e7ab))
* **oidc:** use proper PKCE verifier instead of reusing state ([#167](https://github.com/MacXsimilian/kube-phoenix/issues/167)) ([a9fad8d](https://github.com/MacXsimilian/kube-phoenix/commit/a9fad8d78d1fcbefc1263b3abbfd4cb083843f44))
* **openapi:** rewrite spec to match actual API behavior ([c3672e5](https://github.com/MacXsimilian/kube-phoenix/commit/c3672e5da6ab6e85c504d369f0f8a7b1bff87c4e))
* **overview:** correct node count and make nodes chip navigate to cluster nodes tab ([a7e5820](https://github.com/MacXsimilian/kube-phoenix/commit/a7e5820aeb3b26dc90dd8452db3e442f9c2adc82))
* **overview:** equal-height cards + update docs for reorder and position field ([d33e644](https://github.com/MacXsimilian/kube-phoenix/commit/d33e644fa88798d59ded3f3600e402358f5f032a))
* **overview:** open log drawer after trigger instead of navigating to history ([53e1bf5](https://github.com/MacXsimilian/kube-phoenix/commit/53e1bf5981201b78113446f4c44b0ea67d113bc4))
* **overview:** pin time indicator to right edge in activity feed, fix wake label ([b4906ba](https://github.com/MacXsimilian/kube-phoenix/commit/b4906babbcc76b90616172189aa6e62adcafd3de))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([f59f295](https://github.com/MacXsimilian/kube-phoenix/commit/f59f295a338b28295ce1daaeac9403bd5cd1ea60))
* pull About modal version from package.json instead of hardcoding ([2b0d3a5](https://github.com/MacXsimilian/kube-phoenix/commit/2b0d3a586ba20e025b5b7f67aa43912034514bc1))
* rebuild CHANGELOG.md — remove duplicates from non-squashed merges ([72a1b7b](https://github.com/MacXsimilian/kube-phoenix/commit/72a1b7be8714237ef0e0a46020babef5221147cd))
* **release:** decouple Trivy scan from helm publish — scan failure no longer blocks chart release ([be8d513](https://github.com/MacXsimilian/kube-phoenix/commit/be8d51388de01ce2b2d1303b324bc4e90e1ebc7d))
* **release:** run docker build and helm publish inside release-please workflow ([4a7ca3e](https://github.com/MacXsimilian/kube-phoenix/commit/4a7ca3ecfbd315e9616bca848f5e210af6b3804a))
* remove npm cache — no package-lock.json in repo ([e70d956](https://github.com/MacXsimilian/kube-phoenix/commit/e70d956ab76c5587ee66e01320c58f5fa0060a65))
* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([b9a859a](https://github.com/MacXsimilian/kube-phoenix/commit/b9a859ab238c5f7f6ca81bf5d6005b3e57fb0036))
* replace \n with &lt;br/&gt; in Mermaid diagram node labels ([cd9f32c](https://github.com/MacXsimilian/kube-phoenix/commit/cd9f32c3cd05fa44abf181ac326ccbd2ee9b4813))
* replace release-please action with npx CLI to avoid action policy restriction ([afbe86d](https://github.com/MacXsimilian/kube-phoenix/commit/afbe86d0935aacc43513b398c28407973ceec9df))
* resolve all errcheck lint findings ([3ca850b](https://github.com/MacXsimilian/kube-phoenix/commit/3ca850b8b0ae81b7bc6920ee65aa64905c0e178f))
* resolve frontend and backend CI build failures ([156ab69](https://github.com/MacXsimilian/kube-phoenix/commit/156ab6959ea9b35f6e105a8b5f61eb920251b30a))
* resolve next.config.ts and go embed CI failures ([a2d3514](https://github.com/MacXsimilian/kube-phoenix/commit/a2d351440a4c7593077c40e9044a7b47aa61668e))
* resolve TypeScript and go vet CI failures ([14c7184](https://github.com/MacXsimilian/kube-phoenix/commit/14c7184ca7ecb83b4b1e1a2faaa35e46518290e1))
* restore release-please action now that policy allows google-github-actions/* ([1270b85](https://github.com/MacXsimilian/kube-phoenix/commit/1270b859be787e45ed47428fe71a2d50302d0fc1))
* return clear permission-denied message on 403 ([2ce9dc6](https://github.com/MacXsimilian/kube-phoenix/commit/2ce9dc6185a88e94a2870abd1250a1724c0f11a4))
* revert embedded openapi.yaml tracking; add CI sync assertion ([1c8c697](https://github.com/MacXsimilian/kube-phoenix/commit/1c8c6977f102690d397eeb33034b55c703be23bf))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([6791b1e](https://github.com/MacXsimilian/kube-phoenix/commit/6791b1efb51b5967f89e1f31df73df6e1ee2023e))
* **scaler:** align scale_down with original cronjob logic ([cf24664](https://github.com/MacXsimilian/kube-phoenix/commit/cf246640ce703c612b08c520c1da2eb53fbcf63d))
* schedule toggle persistence, next-run UX, double-v version ([d2fbf2d](https://github.com/MacXsimilian/kube-phoenix/commit/d2fbf2d210bd0196b5276e6fc735f3abebb49474))
* **scheduler:** detach manual trigger from HTTP request context ([de0ed8c](https://github.com/MacXsimilian/kube-phoenix/commit/de0ed8c9751478dd81a18542d743bc03c86d375b))
* **schedules:** move dnd modifiers to correct package ([17b7a0a](https://github.com/MacXsimilian/kube-phoenix/commit/17b7a0ad5ef05c652c8ecf12fb84cc8074d0f352))
* **schedules:** persist enabled toggle via GORM Select workaround, improve next-run display, fix double-v version ([f48a933](https://github.com/MacXsimilian/kube-phoenix/commit/f48a933b92764da104bfea468a62d16af412d1d6))
* **schedules:** resolve stale closure causing toggle not to persist ([0a4e9f1](https://github.com/MacXsimilian/kube-phoenix/commit/0a4e9f122f8eda60394e17ca63ee505aa0bf5d11))
* **schedules:** resolve stale closure causing toggle not to persist ([56d5eaf](https://github.com/MacXsimilian/kube-phoenix/commit/56d5eaf5e9bc00feb4fe70386e6691c51677b898))
* **security:** redact WS token from logs, fix RBAC replicasets, add reset-db audit log ([a2ddf46](https://github.com/MacXsimilian/kube-phoenix/commit/a2ddf46e6780c17e022be09ef6b509f448cce48a))
* **security:** redact WS token from logs, fix RBAC, add reset-db audit log ([d5dc273](https://github.com/MacXsimilian/kube-phoenix/commit/d5dc273d70982314b6762e0edca4e888027a85a0))
* startup recovery, namespace validation, OIDC TLS warning ([#181](https://github.com/MacXsimilian/kube-phoenix/issues/181)) ([6589c42](https://github.com/MacXsimilian/kube-phoenix/commit/6589c422e3869bbcc23b2c923cbff478347ad27b))
* timeUntil shows days for countdowns over 24h ([f91ab22](https://github.com/MacXsimilian/kube-phoenix/commit/f91ab22972c6c473093ad9df58157e69cd520cbc))
* track embedded openapi.yaml so go:embed resolves on CI ([fef4f87](https://github.com/MacXsimilian/kube-phoenix/commit/fef4f874b95ee213d7b5fed5659e142c36113caf))
* **ui:** rework light mode — fix all hardcoded dark colors ([fe9c601](https://github.com/MacXsimilian/kube-phoenix/commit/fe9c601d06296460d94fab0bb7f425c76f4e9493))
* **ui:** WCAG AA light mode colors + settings layout tweaks ([61c3ef4](https://github.com/MacXsimilian/kube-phoenix/commit/61c3ef48e3945baf3fe72c651a2b16a389ca7a79))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([d739f68](https://github.com/MacXsimilian/kube-phoenix/commit/d739f682b1c0c2857df6eef837b7ccfa93a96911))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([8618daf](https://github.com/MacXsimilian/kube-phoenix/commit/8618daf7e5e6259752b6bcde6ae50d67cf3d6b0f))
* use NewRequestWithContext in auth tests (noctx lint) ([3c88769](https://github.com/MacXsimilian/kube-phoenix/commit/3c887694242f2818e9ad3873ab6c4381f11e85a2))
* use npm install in Dockerfile (no package-lock.json) ([048bdc9](https://github.com/MacXsimilian/kube-phoenix/commit/048bdc95f389d02d8442e5f00f3b2a850cdf4779))
* wrap ActivityFeed siblings in Fragment to resolve JSX syntax error ([1acea01](https://github.com/MacXsimilian/kube-phoenix/commit/1acea01ff73908a03d41d5e9e6b3c58de51e9b68))


### Performance Improvements

* **frontend:** performance and code quality audit fixes ([8b34ccc](https://github.com/MacXsimilian/kube-phoenix/commit/8b34ccc354f84431743c268c6af4a9a4bebfe767))
* **overview:** cluster cache, SSE stream, and overview endpoint ([2648442](https://github.com/MacXsimilian/kube-phoenix/commit/2648442cfef43a58b6f6e374e3b9cea25730422e))
* **overview:** cluster cache, SSE stream, and overview endpoint ([56227be](https://github.com/MacXsimilian/kube-phoenix/commit/56227bef92cbe1853837178aeb4b7d91ce02a41d))

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
