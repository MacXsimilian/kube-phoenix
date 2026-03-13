# Changelog

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
