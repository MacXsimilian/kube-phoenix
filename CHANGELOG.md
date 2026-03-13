# Changelog

## [0.1.9](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.8...v0.1.9) (2026-03-13)


### Features

* **frontend:** UX improvements and README overhaul ([63874c1](https://github.com/MacXsimilian/kube-phoenix/commit/63874c1aabd712cf8b9645d558064d6bd347871b))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([286d883](https://github.com/MacXsimilian/kube-phoenix/commit/286d88368eb5d7044565a8da440a94aa0d9d077a))
* **overview:** next-run countdown, partial state, deep-link activity feed ([a2c3b62](https://github.com/MacXsimilian/kube-phoenix/commit/a2c3b620f04649f2dabecd2c07d689f8a56fb92e))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([fa46776](https://github.com/MacXsimilian/kube-phoenix/commit/fa467768955845c6ef997fedf4de15422c628a2e))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([ccbc134](https://github.com/MacXsimilian/kube-phoenix/commit/ccbc134beb322f57db535aa7c2a0a59dfba000dd))
* check json.Encode error in createSchedule 201 response ([83569bf](https://github.com/MacXsimilian/kube-phoenix/commit/83569bf958190e45eb8288204ae8d55e6a818dce))
* grant packages: write at workflow level for reusable docker workflow ([e29c469](https://github.com/MacXsimilian/kube-phoenix/commit/e29c46927d4f9a9d3c896ef636546eb7a54f324b))
* **helm:** address chart audit findings ([d3eba55](https://github.com/MacXsimilian/kube-phoenix/commit/d3eba553c63d2daac26367320cf70fcfcad01cad))
* lowercase GHCR owner for OCI Helm chart push ([bf1689d](https://github.com/MacXsimilian/kube-phoenix/commit/bf1689d20fba5becccb757ad7fc9ab3ccf617813))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([e42fb64](https://github.com/MacXsimilian/kube-phoenix/commit/e42fb64a533f406acd6d0cf17c95537a3dddc399))
* migrate release-please to googleapis/release-please-action v4.4.0 ([7eeacbd](https://github.com/MacXsimilian/kube-phoenix/commit/7eeacbdae330ce1fd84dafd5df23525b66d2ab90))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([ca70a55](https://github.com/MacXsimilian/kube-phoenix/commit/ca70a55e0823b69a6896f03ce091f7b89463fa39))
* remove npm cache — no package-lock.json in repo ([a2a5ecc](https://github.com/MacXsimilian/kube-phoenix/commit/a2a5ecc6525cd2365053badc8b099af766aaf452))
* replace release-please action with npx CLI to avoid action policy restriction ([1dc3f0c](https://github.com/MacXsimilian/kube-phoenix/commit/1dc3f0cfee80061b2907ad021d06babf71cd174d))
* resolve all errcheck lint findings ([f1a9ca4](https://github.com/MacXsimilian/kube-phoenix/commit/f1a9ca4579f4fb2222ee227e767e5627080a822a))
* resolve frontend and backend CI build failures ([9543231](https://github.com/MacXsimilian/kube-phoenix/commit/9543231525fdd79e8f6e530803d592207131e729))
* resolve next.config.ts and go embed CI failures ([625c99c](https://github.com/MacXsimilian/kube-phoenix/commit/625c99c60299d269bfcae13b7da83df0f580b60d))
* resolve TypeScript and go vet CI failures ([22ef85b](https://github.com/MacXsimilian/kube-phoenix/commit/22ef85b6bea6d647b4ae0b37900bf8c2aaa65beb))
* restore release-please action now that policy allows google-github-actions/* ([1269fcd](https://github.com/MacXsimilian/kube-phoenix/commit/1269fcdd14bc022509093588f2e1603762b5e871))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([fb73890](https://github.com/MacXsimilian/kube-phoenix/commit/fb7389025ba7b809fb611e5c86185d33422fff32))
* **scheduler:** detach manual trigger from HTTP request context ([2bbb3b5](https://github.com/MacXsimilian/kube-phoenix/commit/2bbb3b5807d95c8fcdcaf9c38c965f775af9e91c))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([0b04fae](https://github.com/MacXsimilian/kube-phoenix/commit/0b04fae5da14f727c305802996c7a568dc173b2c))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([3a67668](https://github.com/MacXsimilian/kube-phoenix/commit/3a67668c3d11ef7cf61a0b1d2321c43f51c02201))
* use npm install in Dockerfile (no package-lock.json) ([1acba58](https://github.com/MacXsimilian/kube-phoenix/commit/1acba58cda8c430d022f63b1b402558b274a660e))

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
